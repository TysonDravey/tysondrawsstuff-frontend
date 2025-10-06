#!/usr/bin/env python3
"""
TysonDrawsStuff Publishing Manager
A simple GUI for managing the publishing workflow
"""

import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import subprocess
import threading
import os
import json
import requests
import time
from pathlib import Path

class PublishManager:
    def __init__(self, root):
        self.root = root
        self.root.title("TysonDrawsStuff Publishing Manager")
        self.root.geometry("800x600")

        # Paths - script is in frontend/tools, so go up two levels to project root
        self.project_dir = Path(__file__).parent.parent.parent
        self.frontend_dir = self.project_dir / "frontend"
        self.backend_dir = self.project_dir / "backend"

        # Process tracking
        self.strapi_process = None
        self.tunnel_process = None

        # Current tunnel URL
        self.tunnel_url = None
        self.config_file = self.project_dir / ".publish-manager.json"

        self.setup_ui()
        self.load_config()

    def setup_ui(self):
        # Create notebook for tabs
        notebook = ttk.Notebook(self.root)
        notebook.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # Services Tab
        services_frame = ttk.Frame(notebook)
        notebook.add(services_frame, text="Services")
        self.setup_services_tab(services_frame)

        # Images Tab
        images_frame = ttk.Frame(notebook)
        notebook.add(images_frame, text="Images")
        self.setup_images_tab(images_frame)

        # Deploy Tab
        deploy_frame = ttk.Frame(notebook)
        notebook.add(deploy_frame, text="Deploy")
        self.setup_deploy_tab(deploy_frame)

        # Logs Tab
        logs_frame = ttk.Frame(notebook)
        notebook.add(logs_frame, text="Logs")
        self.setup_logs_tab(logs_frame)

    def setup_services_tab(self, parent):
        # Strapi Section
        strapi_frame = ttk.LabelFrame(parent, text="Strapi Backend", padding=10)
        strapi_frame.pack(fill=tk.X, pady=5)

        self.strapi_status = tk.StringVar(value="Stopped")
        ttk.Label(strapi_frame, text="Status:").grid(row=0, column=0, sticky=tk.W)
        ttk.Label(strapi_frame, textvariable=self.strapi_status).grid(row=0, column=1, sticky=tk.W)

        ttk.Label(strapi_frame, text="Port:").grid(row=1, column=0, sticky=tk.W)
        ttk.Label(strapi_frame, text="1339", font=("Courier", 9, "bold")).grid(row=1, column=1, sticky=tk.W)

        ttk.Button(strapi_frame, text="Start Strapi", command=self.start_strapi).grid(row=2, column=0, pady=5)
        ttk.Button(strapi_frame, text="Stop Strapi", command=self.stop_strapi).grid(row=2, column=1, pady=5)
        ttk.Button(strapi_frame, text="Open Admin", command=self.open_strapi_admin).grid(row=2, column=2, pady=5)

        # Tunnel Section
        tunnel_frame = ttk.LabelFrame(parent, text="Cloudflare Tunnel", padding=10)
        tunnel_frame.pack(fill=tk.X, pady=5)

        self.tunnel_status = tk.StringVar(value="Stopped")
        self.tunnel_url_var = tk.StringVar(value="No tunnel active")

        ttk.Label(tunnel_frame, text="Status:").grid(row=0, column=0, sticky=tk.W)
        ttk.Label(tunnel_frame, textvariable=self.tunnel_status).grid(row=0, column=1, sticky=tk.W)

        ttk.Label(tunnel_frame, text="URL:").grid(row=1, column=0, sticky=tk.W)

        # Create a copyable URL field
        self.tunnel_url_entry = tk.Entry(tunnel_frame, textvariable=self.tunnel_url_var,
                                        state="readonly", width=50, relief="flat",
                                        readonlybackground="white", foreground="blue")
        self.tunnel_url_entry.grid(row=1, column=1, sticky=tk.W, padx=(5, 0))

        # Add copy button
        ttk.Button(tunnel_frame, text="📋 Copy", width=8,
                  command=self.copy_tunnel_url).grid(row=1, column=2, padx=(5, 0))

        ttk.Button(tunnel_frame, text="Start Tunnel", command=self.start_tunnel).grid(row=2, column=0, pady=5)
        ttk.Button(tunnel_frame, text="Stop Tunnel", command=self.stop_tunnel).grid(row=2, column=1, pady=5)
        ttk.Button(tunnel_frame, text="🔄 Update Env Vars", command=self.update_vercel_env).grid(row=2, column=2, pady=5)

        # Branch Management Section
        branch_frame = ttk.LabelFrame(parent, text="Branch Management", padding=10)
        branch_frame.pack(fill=tk.X, pady=5)

        self.current_branch = tk.StringVar(value="Checking...")
        ttk.Label(branch_frame, text="Current Branch:").grid(row=0, column=0, sticky=tk.W)
        ttk.Label(branch_frame, textvariable=self.current_branch, font=("Courier", 9, "bold")).grid(row=0, column=1, sticky=tk.W)

        button_frame = ttk.Frame(branch_frame)
        button_frame.grid(row=1, column=0, columnspan=2, pady=5, sticky=tk.W)

        ttk.Button(button_frame, text="Switch to Preview", command=self.switch_to_preview).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(button_frame, text="Switch to Main", command=self.switch_to_main).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(button_frame, text="Merge Preview→Main", command=self.merge_preview_to_main).pack(side=tk.LEFT)

        # Bulk Image Uploader Section
        uploader_frame = ttk.LabelFrame(parent, text="Bulk Image Uploader", padding=10)
        uploader_frame.pack(fill=tk.X, pady=5)

        ttk.Button(uploader_frame, text="📸 Launch Bulk Image Uploader",
                  command=self.launch_bulk_uploader).pack(pady=5)

    def setup_images_tab(self, parent):
        # Image Sync Section
        sync_frame = ttk.LabelFrame(parent, text="Image Synchronization", padding=10)
        sync_frame.pack(fill=tk.X, pady=5)

        self.sync_status = tk.StringVar(value="Ready")
        ttk.Label(sync_frame, text="Status:").grid(row=0, column=0, sticky=tk.W)
        ttk.Label(sync_frame, textvariable=self.sync_status).grid(row=0, column=1, sticky=tk.W)

        ttk.Button(sync_frame, text="Sync All Images", command=self.sync_images).grid(row=1, column=0, pady=5)
        ttk.Button(sync_frame, text="View Image Map", command=self.view_image_map).grid(row=1, column=1, pady=5)

        # Statistics Section
        stats_frame = ttk.LabelFrame(parent, text="Image Statistics", padding=10)
        stats_frame.pack(fill=tk.X, pady=5)

        self.stats_text = tk.Text(stats_frame, height=8, width=60)
        self.stats_text.pack(fill=tk.BOTH, expand=True)

        self.update_image_stats()

    def setup_deploy_tab(self, parent):
        # Current Branch Indicator
        branch_frame = ttk.Frame(parent, padding=5)
        branch_frame.pack(fill=tk.X, pady=5)

        ttk.Label(branch_frame, text="Current Branch:", font=("Arial", 10, "bold")).pack(side=tk.LEFT, padx=5)
        self.branch_label = ttk.Label(branch_frame, text="preview", font=("Courier", 12, "bold"), foreground="green")
        self.branch_label.pack(side=tk.LEFT, padx=5)

        ttk.Button(branch_frame, text="🔄 Refresh", command=self.update_branch_display).pack(side=tk.LEFT, padx=5)
        ttk.Button(branch_frame, text="🔀 Switch to Preview", command=self.switch_to_preview).pack(side=tk.LEFT, padx=5)

        # Git Section
        git_frame = ttk.LabelFrame(parent, text="Git Operations", padding=10)
        git_frame.pack(fill=tk.X, pady=5)

        self.git_status_text = tk.Text(git_frame, height=6, width=60)
        self.git_status_text.pack(fill=tk.BOTH, expand=True, pady=5)

        button_frame = ttk.Frame(git_frame)
        button_frame.pack(fill=tk.X, pady=5)

        ttk.Button(button_frame, text="Git Status", command=self.git_status).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="Commit & Push", command=self.commit_and_push).pack(side=tk.LEFT, padx=5)

        # Deployment Section
        deploy_frame = ttk.LabelFrame(parent, text="Deployment", padding=10)
        deploy_frame.pack(fill=tk.X, pady=5)

        self.deploy_status = tk.StringVar(value="Ready")
        ttk.Label(deploy_frame, text="Status:").grid(row=0, column=0, sticky=tk.W)
        ttk.Label(deploy_frame, textvariable=self.deploy_status).grid(row=0, column=1, sticky=tk.W)

        # Deployment buttons
        button_frame = ttk.Frame(deploy_frame)
        button_frame.grid(row=1, column=0, columnspan=2, pady=10, sticky=tk.W)

        ttk.Button(button_frame, text="🔍 Deploy Preview",
                  command=self.deploy_preview,
                  style="Accent.TButton").pack(side=tk.LEFT, padx=(0, 10))

        ttk.Button(button_frame, text="🚀 Deploy Production",
                  command=self.deploy_production).pack(side=tk.LEFT, padx=(0, 10))

        ttk.Button(button_frame, text="🎯 Promote to Production",
                  command=self.promote_to_production,
                  style="Accent.TButton").pack(side=tk.LEFT)

        # Quick Actions
        actions_frame = ttk.LabelFrame(parent, text="Quick Actions", padding=10)
        actions_frame.pack(fill=tk.X, pady=5)

        ttk.Label(actions_frame, text="New Preview → Production Pipeline:", font=("Arial", 9, "bold")).pack(anchor=tk.W, pady=(0, 5))

        workflow_frame = ttk.Frame(actions_frame)
        workflow_frame.pack(fill=tk.X, pady=5)

        ttk.Button(workflow_frame, text="🔄 Sync & Preview Workflow",
                  command=self.preview_workflow,
                  style="Accent.TButton").pack(side=tk.LEFT, padx=(0, 10))

        ttk.Button(workflow_frame, text="🚀 Full Production Pipeline",
                  command=self.production_pipeline).pack(side=tk.LEFT)

        # Legacy option (smaller, less prominent)
        ttk.Label(actions_frame, text="Legacy:", font=("Arial", 8)).pack(anchor=tk.W, pady=(15, 0))
        ttk.Button(actions_frame, text="Old Full Workflow (Deprecated)",
                  command=self.old_full_workflow).pack(anchor=tk.W, pady=(0, 5))

        # Update branch display on startup
        self.update_branch_display()

    def setup_logs_tab(self, parent):
        self.log_text = scrolledtext.ScrolledText(parent, wrap=tk.WORD)
        self.log_text.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # Button frame
        button_frame = ttk.Frame(parent)
        button_frame.pack(pady=5)

        # Copy and Clear buttons
        ttk.Button(button_frame, text="📋 Copy Logs", command=self.copy_all_logs).pack(side=tk.LEFT, padx=(0, 5))
        ttk.Button(button_frame, text="Clear Logs", command=self.clear_logs).pack(side=tk.LEFT)

    def log(self, message):
        """Add message to logs with timestamp"""
        timestamp = time.strftime("%H:%M:%S")
        self.log_text.insert(tk.END, f"[{timestamp}] {message}\n")
        self.log_text.see(tk.END)
        self.root.update()

    def copy_all_logs(self):
        """Copy all logs to clipboard"""
        all_logs = self.log_text.get(1.0, tk.END)
        if all_logs.strip():
            self.root.clipboard_clear()
            self.root.clipboard_append(all_logs)
            self.root.update()
            self.log("📋 All logs copied to clipboard")
        else:
            self.log("⚠️ No logs to copy")

    def clear_logs(self):
        self.log_text.delete(1.0, tk.END)

    def update_branch_display(self):
        """Update the current branch display"""
        try:
            result = subprocess.run("git branch --show-current", shell=True,
                                  cwd=self.frontend_dir, capture_output=True,
                                  text=True, encoding='utf-8', errors='replace')
            if result.returncode == 0:
                branch = result.stdout.strip()
                self.branch_label.config(text=branch)

                # Color code: preview = green, main = red, other = orange
                if branch == "preview":
                    self.branch_label.config(foreground="green")
                elif branch == "main":
                    self.branch_label.config(foreground="red")
                else:
                    self.branch_label.config(foreground="orange")
        except Exception as e:
            self.branch_label.config(text="unknown", foreground="gray")

    def run_command(self, command, cwd=None, capture_output=True):
        """Run a command and return the result"""
        try:
            if cwd is None:
                cwd = self.frontend_dir

            self.log(f"Running: {command}")

            if capture_output:
                result = subprocess.run(command, shell=True, cwd=cwd,
                                      capture_output=True, text=True,
                                      encoding='utf-8', errors='replace')
                if result.stdout:
                    self.log(f"Output: {result.stdout.strip()}")
                if result.stderr:
                    self.log(f"Error: {result.stderr.strip()}")
                return result
            else:
                # For background processes - capture output for tunnel monitoring
                return subprocess.Popen(command, shell=True, cwd=cwd,
                                       stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                       text=True, bufsize=1, universal_newlines=True,
                                       encoding='utf-8', errors='replace')

        except Exception as e:
            self.log(f"Command failed: {e}")
            return None

    def start_strapi(self):
        """Start Strapi backend"""
        if self.strapi_process is None or self.strapi_process.poll() is not None:
            self.log("Starting Strapi backend...")
            self.strapi_process = self.run_command("npm run develop",
                                                 cwd=self.backend_dir,
                                                 capture_output=False)
            self.strapi_status.set("Starting...")

            # Check if started successfully after a delay
            self.root.after(8000, self.check_strapi_status)
        else:
            self.log("Strapi is already running")

    def stop_strapi(self):
        """Stop Strapi backend"""
        self.log("Stopping Strapi backend...")

        # Kill any process on port 1339
        kill_result = self.run_command("npx kill-port 1339")

        if self.strapi_process and self.strapi_process.poll() is None:
            self.strapi_process.terminate()

        # Always clear the process reference when stopping
        self.strapi_process = None
        self.strapi_status.set("Stopped")
        self.log("Strapi stopped successfully")

    def check_strapi_status(self):
        """Check if Strapi is running"""
        try:
            response = requests.get("http://localhost:1339/api", timeout=3)
            if response.status_code in [200, 403, 404]:  # Any response means it's running
                self.strapi_status.set("✅ Running")
                self.log("✅ Strapi is running successfully")
                return
        except:
            pass

        # Check if process is still running
        if self.strapi_process and self.strapi_process.poll() is None:
            self.strapi_status.set("Starting...")
            self.log("Strapi is still starting up...")
            self.root.after(3000, self.check_strapi_status)
        else:
            self.strapi_status.set("Stopped")
            if self.strapi_process:
                self.strapi_process = None

    def open_strapi_admin(self):
        """Open Strapi admin in browser"""
        import webbrowser
        webbrowser.open("http://localhost:1339/admin")
        self.log("Opening Strapi admin in browser...")

    def start_tunnel(self):
        """Start Cloudflare tunnel"""
        if self.tunnel_process is None or self.tunnel_process.poll() is not None:
            self.log("Starting Cloudflare tunnel for port 1339...")

            # Try to find cloudflared
            cloudflared_path = self.project_dir / "cloudflared.exe"
            if cloudflared_path.exists():
                cmd = f'"{cloudflared_path}" tunnel --url http://localhost:1339'
                self.log("Using local cloudflared.exe")
            else:
                # Try npx
                cmd = 'npx cloudflared tunnel --url http://localhost:1339'
                self.log("Using npx cloudflared")

            self.tunnel_process = self.run_command(cmd, capture_output=False)
            self.tunnel_status.set("Starting...")

            # Monitor tunnel output for URL
            threading.Thread(target=self.monitor_tunnel, daemon=True).start()
        else:
            self.log("Tunnel is already running")

    def stop_tunnel(self):
        """Stop Cloudflare tunnel"""
        if self.tunnel_process and self.tunnel_process.poll() is None:
            self.log("Stopping tunnel...")
            self.tunnel_process.terminate()
            self.tunnel_process = None
            self.tunnel_status.set("Stopped")
            self.tunnel_url_var.set("No tunnel active")
            self.tunnel_url = None
        else:
            self.log("Tunnel is not running")

    def monitor_tunnel(self):
        """Monitor tunnel process for URL"""
        import re

        self.log("🔄 Monitoring tunnel startup...")

        try:
            if self.tunnel_process and self.tunnel_process.stderr:
                for line in iter(self.tunnel_process.stderr.readline, ''):
                    if not line:
                        break
                    line = line.strip()
                    if line:
                        self.log(f"Tunnel: {line}")

                        # Look for the tunnel URL pattern
                        url_match = re.search(r'https://[a-zA-Z0-9\-]+\.trycloudflare\.com', line)
                        if url_match:
                            tunnel_url = url_match.group(0)
                            self.tunnel_url = tunnel_url
                            self.tunnel_url_var.set(tunnel_url)
                            self.tunnel_status.set("✅ Running")
                            self.log(f"✅ Tunnel active at: {tunnel_url}")
                            self.save_config()  # Save tunnel URL for next session

                            # Auto-update local .env.local file
                            self.update_local_env(tunnel_url)
                            return
        except Exception as e:
            self.log(f"Error reading tunnel output: {e}")

        # If we get here, tunnel might have failed
        if self.tunnel_process and self.tunnel_process.poll() is not None:
            self.tunnel_status.set("❌ Failed")
            self.log("❌ Tunnel process failed to start")

    def sync_images(self):
        """Sync all images from Strapi"""
        self.sync_status.set("Syncing...")
        self.log("Starting image synchronization...")

        def sync_thread():
            result = self.run_command("npm run sync-images")
            if result and result.returncode == 0:
                self.sync_status.set("Complete")
                self.log("Image sync completed successfully")
                self.update_image_stats()
            else:
                self.sync_status.set("Failed")
                self.log("Image sync failed")

        threading.Thread(target=sync_thread, daemon=True).start()

    def get_current_branch(self):
        """Get current git branch"""
        result = self.run_command("git branch --show-current")
        if result and result.returncode == 0:
            branch = result.stdout.strip()
            self.current_branch.set(branch)
            return branch
        return "unknown"

    def switch_to_preview(self):
        """Switch to preview branch"""
        self.log("🔄 Switching to preview branch...")
        result = self.run_command("git checkout preview")
        if result and result.returncode == 0:
            self.log("✅ Switched to preview branch")
            self.get_current_branch()
        else:
            # Try to create preview branch
            create_result = self.run_command("git checkout -b preview")
            if create_result and create_result.returncode == 0:
                self.log("✅ Created and switched to preview branch")
                self.get_current_branch()
            else:
                self.log("❌ Failed to switch to preview branch")

    def switch_to_main(self):
        """Switch to main/master branch"""
        self.log("🔄 Switching to main branch...")
        # Try main first, then master
        result = self.run_command("git checkout main")
        if result and result.returncode != 0:
            result = self.run_command("git checkout master")

        if result and result.returncode == 0:
            self.log("✅ Switched to main/master branch")
            self.get_current_branch()
        else:
            self.log("❌ Failed to switch to main branch")

    def merge_preview_to_main(self):
        """Merge preview branch to main"""
        if not messagebox.askyesno("Merge Branches",
                                  "This will merge preview branch into main branch.\n\nContinue?"):
            return

        def merge_thread():
            self.log("🔄 Merging preview to main...")

            # Switch to main
            self.run_command("git checkout main 2>/dev/null || git checkout master")

            # Pull latest
            self.run_command("git pull origin main 2>/dev/null || git pull origin master")

            # Merge preview
            merge_result = self.run_command("git merge preview")
            if merge_result and merge_result.returncode == 0:
                self.log("✅ Successfully merged preview to main")

                # Push to main
                push_result = self.run_command("git push origin main 2>/dev/null || git push origin master")
                if push_result and push_result.returncode == 0:
                    self.log("✅ Pushed merged changes to main")
                else:
                    self.log("⚠️ Merge successful but push failed")
            else:
                self.log("❌ Failed to merge preview to main - check for conflicts")

            self.get_current_branch()

        threading.Thread(target=merge_thread, daemon=True).start()

    def preview_workflow(self):
        """Run the preview workflow: sync images, commit to preview, deploy preview"""
        if not messagebox.askyesno("Preview Workflow",
                                  "This will:\n1. Switch to preview branch\n2. Sync images from Strapi\n3. Commit and push to preview\n4. Deploy to preview\n\nContinue?"):
            return

        def preview_thread():
            self.log("=== Starting Preview Workflow ===")

            # 1. Switch to preview
            self.log("Step 1: Switching to preview branch...")
            self.switch_to_preview()
            time.sleep(1)

            # 2. Sync images
            self.log("Step 2: Syncing images from Strapi...")
            sync_result = self.run_command("npm run sync-images")
            if sync_result and sync_result.returncode == 0:
                self.log("✅ Images synced successfully")
            else:
                self.log("⚠️ Image sync may have failed")

            # 3. Commit and push to preview
            self.log("Step 3: Committing changes to preview...")
            self.run_command("git add .")
            commit_result = self.run_command('git commit -m "Sync images and content updates for preview"')
            if commit_result and commit_result.returncode == 0:
                push_result = self.run_command("git push origin preview")
                if push_result and push_result.returncode == 0:
                    self.log("✅ Changes pushed to preview branch")
                else:
                    self.log("⚠️ Commit successful but push failed")
            else:
                self.log("ℹ️ No changes to commit or already up to date")

            # 4. Deploy to preview
            self.log("Step 4: Deploying to preview...")
            self.deploy_preview()

            self.log("=== Preview Workflow Complete ===")
            self.log("🔍 Check Vercel dashboard for preview URL!")

        threading.Thread(target=preview_thread, daemon=True).start()

    def production_pipeline(self):
        """Run the full production pipeline: merge to main, deploy to production"""
        if not messagebox.askyesno("Production Pipeline",
                                  "⚠️ FULL PRODUCTION DEPLOYMENT ⚠️\n\nThis will:\n1. Merge preview → main branch\n2. Deploy to LIVE PRODUCTION site\n\nOnly proceed if preview looks good!\n\nContinue?"):
            return

        def production_thread():
            self.log("=== Starting Production Pipeline ===")

            # 1. Merge preview to main
            self.log("Step 1: Merging preview to main...")
            self.merge_preview_to_main()
            time.sleep(3)  # Wait for merge to complete

            # 2. Deploy to production
            self.log("Step 2: Deploying to production...")
            self.deploy_production()

            self.log("=== Production Pipeline Complete ===")
            self.log("🌍 Your changes are now live at tysondrawsstuff.com!")

        threading.Thread(target=production_thread, daemon=True).start()

    def update_local_env(self, tunnel_url):
        """Update local .env.local file with tunnel URL"""
        try:
            env_file = self.frontend_dir / ".env.local"

            # Read existing env file or create new
            env_lines = []
            if env_file.exists():
                with open(env_file, 'r') as f:
                    env_lines = f.readlines()

            # Update or add NEXT_PUBLIC_STRAPI_URL
            found = False
            for i, line in enumerate(env_lines):
                if line.startswith('NEXT_PUBLIC_STRAPI_URL='):
                    env_lines[i] = f'NEXT_PUBLIC_STRAPI_URL={tunnel_url}\n'
                    found = True
                    break

            if not found:
                env_lines.append(f'NEXT_PUBLIC_STRAPI_URL={tunnel_url}\n')

            # Write back to file
            with open(env_file, 'w') as f:
                f.writelines(env_lines)

            self.log(f"✅ Auto-updated local .env.local with tunnel URL")
        except Exception as e:
            self.log(f"⚠️ Could not auto-update .env.local: {e}")

    def update_vercel_env(self):
        """Update both local .env.local and Vercel environment variable with tunnel URL"""
        if not self.tunnel_url or 'trycloudflare.com' not in self.tunnel_url:
            self.log("❌ No active tunnel URL. Start tunnel first.")
            messagebox.showwarning("No Tunnel", "Please start the tunnel first to get a URL.")
            return

        self.log(f"📝 Updating environment variables with: {self.tunnel_url}")

        def update_thread():
            success_count = 0

            # 1. Update local .env.local file
            try:
                env_file = self.frontend_dir / ".env.local"

                # Read existing env file or create new
                env_lines = []
                if env_file.exists():
                    with open(env_file, 'r') as f:
                        env_lines = f.readlines()

                # Update or add NEXT_PUBLIC_STRAPI_URL
                found = False
                for i, line in enumerate(env_lines):
                    if line.startswith('NEXT_PUBLIC_STRAPI_URL='):
                        env_lines[i] = f'NEXT_PUBLIC_STRAPI_URL={self.tunnel_url}\n'
                        found = True
                        break

                if not found:
                    env_lines.append(f'NEXT_PUBLIC_STRAPI_URL={self.tunnel_url}\n')

                # Write back to file
                with open(env_file, 'w') as f:
                    f.writelines(env_lines)

                self.log(f"✅ Updated local .env.local file")
                success_count += 1
            except Exception as e:
                self.log(f"❌ Failed to update .env.local: {e}")

            # 2. Update Vercel environment variable
            try:
                result = self.run_command(
                    f'npm run update-vercel-env "{self.tunnel_url}"',
                    cwd=self.frontend_dir
                )
                if result and result.returncode == 0:
                    self.log("✅ Updated Vercel environment variable")
                    success_count += 1
                else:
                    self.log("❌ Failed to update Vercel (check VERCEL_TOKEN in .env.local)")
            except Exception as e:
                self.log(f"❌ Failed to update Vercel: {e}")

            # Summary
            if success_count == 2:
                self.log(f"🎉 Successfully updated both local and Vercel environments!")
                messagebox.showinfo("Success", f"Environment variables updated!\n\nLocal: .env.local\nVercel: Remote project\n\nURL: {self.tunnel_url}")
            elif success_count == 1:
                self.log(f"⚠️ Partially successful - check logs for details")
                messagebox.showwarning("Partial Success", "Only one environment was updated. Check logs for details.")
            else:
                self.log(f"❌ Failed to update environments")
                messagebox.showerror("Failed", "Could not update environment variables. Check logs for details.")

        threading.Thread(target=update_thread, daemon=True).start()

    def deploy_preview(self):
        """Deploy to preview (develop branch)"""
        deploy_hook = self.get_vercel_deploy_hook('preview')

        if not deploy_hook:
            self.log("⚠️ No Vercel Deploy Hook configured for preview")
            self.log("To set up:")
            self.log("1. Go to Vercel dashboard → Settings → Git → Deploy Hooks")
            self.log("2. Create a Deploy Hook for preview branch")
            self.log("3. Add VERCEL_DEPLOY_HOOK_PREVIEW=<url> to frontend/.env.local")
            return

        self.deploy_status.set("Deploying Preview...")
        self.log("🔍 Triggering preview deployment (preview branch)...")

        def preview_deploy_thread():
            try:
                response = requests.post(deploy_hook, timeout=10)
                if response.status_code in [200, 201, 202]:
                    self.deploy_status.set("Preview Triggered")
                    self.log("✅ Preview deployment triggered successfully!")
                    self.log("Check Vercel dashboard for preview URL")
                else:
                    self.deploy_status.set("Preview Failed")
                    self.log(f"❌ Failed to trigger preview: HTTP {response.status_code}")
            except Exception as e:
                self.deploy_status.set("Preview Error")
                self.log(f"❌ Error triggering preview deployment: {e}")

        threading.Thread(target=preview_deploy_thread, daemon=True).start()

    def deploy_production(self):
        """Deploy to production (main branch)"""
        deploy_hook = self.get_vercel_deploy_hook('production')

        if not deploy_hook:
            self.log("⚠️ No Vercel Deploy Hook configured for production")
            self.log("To set up:")
            self.log("1. Go to Vercel dashboard → Settings → Git → Deploy Hooks")
            self.log("2. Create a Deploy Hook for main/production branch")
            self.log("3. Add VERCEL_DEPLOY_HOOK_PRODUCTION=<url> to frontend/.env.local")
            return

        # Confirm production deployment
        if not messagebox.askyesno("Production Deployment",
                                  "⚠️ This will deploy to LIVE PRODUCTION site!\n\nAre you sure you want to continue?"):
            return

        self.deploy_status.set("Deploying Production...")
        self.log("🚀 Triggering production deployment (main branch)...")

        def production_deploy_thread():
            try:
                response = requests.post(deploy_hook, timeout=10)
                if response.status_code in [200, 201, 202]:
                    self.deploy_status.set("Production Triggered")
                    self.log("✅ Production deployment triggered successfully!")
                    self.log("🌍 Your changes will be live at tysondrawsstuff.com in a few minutes")
                else:
                    self.deploy_status.set("Production Failed")
                    self.log(f"❌ Failed to trigger production: HTTP {response.status_code}")
            except Exception as e:
                self.deploy_status.set("Production Error")
                self.log(f"❌ Error triggering production deployment: {e}")

        threading.Thread(target=production_deploy_thread, daemon=True).start()

    def trigger_deploy(self):
        """Legacy method - redirect to production deploy"""
        self.deploy_production()

    def get_vercel_deploy_hook(self, environment='preview'):
        """Get Vercel Deploy Hook URL from frontend/.env.local"""
        try:
            env_file = self.frontend_dir / ".env.local"
            if not env_file.exists():
                return None

            # Look for environment-specific hook first
            hook_key = f'VERCEL_DEPLOY_HOOK_{environment.upper()}'

            with open(env_file, 'r') as f:
                for line in f:
                    if line.startswith(f'{hook_key}='):
                        return line.split('=', 1)[1].strip()
        except Exception as e:
            self.log(f"⚠️ Error reading deploy hook: {e}")

        return None

    def switch_to_preview_from_deploy(self):
        """Switch to preview branch for development work (from deploy tab)"""
        self.log("🔀 Switching to preview branch...")

        def switch_thread():
            try:
                result = self.run_command("git checkout preview", cwd=self.frontend_dir)
                if result and result.returncode == 0:
                    self.log("✅ Switched to preview branch")
                    self.update_branch_display()
                else:
                    self.log("❌ Failed to switch to preview branch")
            except Exception as e:
                self.log(f"❌ Error switching branch: {e}")

        threading.Thread(target=switch_thread, daemon=True).start()

    def promote_to_production(self):
        """Promote preview branch to production by merging to main"""
        import tkinter.messagebox as messagebox

        # Confirm action
        confirmed = messagebox.askyesno(
            "Promote to Production",
            "This will merge the 'preview' branch into 'main' and push to production.\n\n"
            "Make sure the preview deployment looks good before proceeding.\n\n"
            "Continue?"
        )

        if not confirmed:
            self.log("ℹ️ Promotion cancelled")
            return

        self.log("🎯 Promoting preview to production...")

        def promote_thread():
            try:
                # Check for uncommitted changes first
                status_result = self.run_command("git status --porcelain", cwd=self.frontend_dir)
                if status_result and status_result.stdout.strip():
                    self.log("⚠️ You have uncommitted changes!")
                    self.log("❌ Please commit or stash your changes before promoting")
                    self.log("💡 Run 'git status' to see uncommitted files")
                    return

                # Make sure we're on preview branch
                self.run_command("git checkout preview", cwd=self.frontend_dir)

                # Pull latest
                self.run_command("git pull origin preview", cwd=self.frontend_dir)

                # Checkout main
                result = self.run_command("git checkout main", cwd=self.frontend_dir)
                if result and result.returncode != 0:
                    self.log("❌ Failed to checkout main branch")
                    # Always try to get back to preview
                    self.run_command("git checkout preview", cwd=self.frontend_dir)
                    return

                # Pull latest main
                self.run_command("git pull origin main", cwd=self.frontend_dir)

                # Merge preview into main (use double quotes for Windows compatibility)
                result = self.run_command('git merge preview -m "Promote preview to production"', cwd=self.frontend_dir)
                if result and result.returncode != 0:
                    self.log("❌ Failed to merge preview into main")
                    self.log("⚠️ You may need to resolve conflicts manually")
                    # Always switch back to preview
                    self.run_command("git checkout preview", cwd=self.frontend_dir)
                    return

                # Push to main
                result = self.run_command("git push origin main", cwd=self.frontend_dir)
                if result and result.returncode == 0:
                    self.log("✅ Successfully promoted to production!")
                    self.log("🚀 Production deployment will start automatically")
                    self.log("📊 Check Vercel dashboard for progress")
                else:
                    self.log("❌ Failed to push to main branch")

                # ALWAYS switch back to preview branch, no matter what
                self.run_command("git checkout preview", cwd=self.frontend_dir)
                self.log("🔄 Switched back to preview branch")

                # Update branch display
                self.update_branch_display()

            except Exception as e:
                self.log(f"❌ Error during promotion: {e}")
                # Even on exception, try to get back to preview
                try:
                    self.run_command("git checkout preview", cwd=self.frontend_dir)
                    self.log("🔄 Switched back to preview branch")
                    self.update_branch_display()
                except:
                    self.log("⚠️ Could not switch back to preview - please check branch manually")
                    self.update_branch_display()

        threading.Thread(target=promote_thread, daemon=True).start()

    def view_image_map(self):
        """View current image mapping"""
        try:
            image_map_file = self.frontend_dir / "image-map.json"
            with open(image_map_file, 'r') as f:
                data = json.load(f)

            # Create new window to show image map
            map_window = tk.Toplevel(self.root)
            map_window.title("Image Map")
            map_window.geometry("600x400")

            text_widget = scrolledtext.ScrolledText(map_window, wrap=tk.WORD)
            text_widget.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

            text_widget.insert(tk.END, json.dumps(data, indent=2))
            text_widget.config(state=tk.DISABLED)

        except Exception as e:
            self.log(f"Error viewing image map: {e}")

    def copy_tunnel_url(self):
        """Copy tunnel URL to clipboard"""
        if self.tunnel_url and 'trycloudflare.com' in self.tunnel_url:
            self.root.clipboard_clear()
            self.root.clipboard_append(self.tunnel_url)
            self.root.update()  # Now it stays on the clipboard after the window is closed
            self.log(f"📋 Copied tunnel URL to clipboard: {self.tunnel_url}")
        else:
            self.log("⚠️ No tunnel URL available to copy")

    def update_image_stats(self):
        """Update image statistics display"""
        try:
            image_map_file = self.frontend_dir / "image-map.json"
            with open(image_map_file, 'r') as f:
                data = json.load(f)

            products = data.get('products', {})
            static = data.get('static', {})
            last_sync = data.get('lastSync', 'Never')

            total_products = len(products)
            total_product_images = sum(len(images) for images in products.values())
            total_static_assets = len(static)

            stats = f"""Image Statistics:

Products: {total_products}
Product Images: {total_product_images}
Static Assets: {total_static_assets}
Total Images: {total_product_images + total_static_assets}

Last Sync: {last_sync}

Recent Products:"""

            # Add last few products
            for i, (slug, images) in enumerate(list(products.items())[-5:]):
                stats += f"\n  • {slug} ({len(images)} images)"

            self.stats_text.delete(1.0, tk.END)
            self.stats_text.insert(tk.END, stats)

        except Exception as e:
            self.stats_text.delete(1.0, tk.END)
            self.stats_text.insert(tk.END, f"Error loading stats: {e}")

    def git_status(self):
        """Show git status"""
        result = self.run_command("git status")
        if result:
            self.git_status_text.delete(1.0, tk.END)
            self.git_status_text.insert(tk.END, result.stdout)

    def commit_and_push(self):
        """Commit and push changes to current branch"""
        current_branch = self.get_current_branch()

        # Simple commit dialog
        commit_msg = tk.simpledialog.askstring("Commit Message",
                                             f"Enter commit message (pushing to {current_branch}):",
                                             initialvalue="Update images and sync")
        if commit_msg:
            self.log(f"Committing and pushing changes to {current_branch}...")

            def git_thread():
                # Add all changes
                self.run_command("git add .")

                # Commit
                result = self.run_command(f'git commit -m "{commit_msg}"')
                if result and result.returncode == 0:
                    # Push to current branch
                    push_result = self.run_command(f"git push origin {current_branch}")
                    if push_result and push_result.returncode == 0:
                        self.log(f"✅ Successfully committed and pushed changes to {current_branch}")
                    else:
                        self.log(f"❌ Failed to push changes to {current_branch}")
                else:
                    self.log("ℹ️ No changes to commit or commit failed")

            threading.Thread(target=git_thread, daemon=True).start()

    def old_full_workflow(self):
        """DEPRECATED: Run the old publishing workflow"""
        if messagebox.askyesno("Old Workflow (Deprecated)",
                              "⚠️ This is the OLD workflow and may not work correctly.\n\nThis will:\n1. Start Strapi\n2. Start tunnel\n3. Sync images\n4. Update Vercel\n5. Commit & push\n6. Deploy\n\n⚠️ Use new Preview/Production pipeline instead!\n\nContinue anyway?"):

            self.log("=== Starting Full Publishing Workflow ===")

            def workflow_thread():
                try:
                    # 1. Start Strapi
                    self.start_strapi()
                    time.sleep(10)  # Wait for Strapi to start

                    # 2. Start tunnel
                    self.start_tunnel()
                    time.sleep(5)  # Wait for tunnel

                    # 3. Sync images
                    self.log("Step 3: Syncing images...")
                    sync_result = self.run_command("npm run sync-images")
                    if sync_result and sync_result.returncode == 0:
                        self.log("Images synced successfully")

                    # 4. Update Vercel (if tunnel URL available)
                    if self.tunnel_url:
                        self.log("Step 4: Updating Vercel environment...")
                        self.run_command(f"npm run update-vercel-env \"{self.tunnel_url}\"")

                    # 5. Commit and push
                    self.log("Step 5: Committing changes...")
                    self.run_command("git add .")
                    commit_result = self.run_command('git commit -m "Automated image sync and deployment"')
                    if commit_result and commit_result.returncode == 0:
                        self.run_command("git push")
                        self.log("Changes pushed successfully")

                    # 6. Trigger deployment
                    self.log("Step 6: Triggering deployment...")
                    self.trigger_deploy()

                    self.log("=== Full Workflow Complete ===")

                except Exception as e:
                    self.log(f"Workflow error: {e}")

            threading.Thread(target=workflow_thread, daemon=True).start()

    def save_config(self):
        """Save configuration to file"""
        try:
            config = {
                'tunnel_url': self.tunnel_url if self.tunnel_url else None
            }
            with open(self.config_file, 'w') as f:
                json.dump(config, f, indent=2)
        except Exception as e:
            self.log(f"⚠️ Failed to save config: {e}")

    def load_saved_config(self):
        """Load saved configuration"""
        try:
            if self.config_file.exists():
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                    saved_tunnel_url = config.get('tunnel_url')
                    if saved_tunnel_url:
                        self.tunnel_url = saved_tunnel_url
                        self.tunnel_url_var.set(saved_tunnel_url)
                        self.log(f"📋 Loaded saved tunnel URL: {saved_tunnel_url}")
                        # Check if this tunnel is still active
                        self.root.after(1000, self.check_tunnel_status)  # Delay check slightly
                    return config
            else:
                self.log(f"⚠️ No saved config found at: {self.config_file}")
        except Exception as e:
            self.log(f"⚠️ Failed to load config: {e}")
            import traceback
            self.log(traceback.format_exc())
        return {}

    def check_tunnel_status(self):
        """Check if saved tunnel URL is still active"""
        if not self.tunnel_url or 'trycloudflare.com' not in self.tunnel_url:
            self.log("⚠️ No valid tunnel URL to check")
            return

        try:
            self.log(f"🔍 Checking if tunnel is still active...")
            response = requests.get(f"{self.tunnel_url}/api", timeout=5)
            if response.status_code in [200, 403, 404]:  # Any response means tunnel is active
                self.tunnel_status.set("✅ Running")
                self.log(f"✅ Tunnel is still active!")
            else:
                self.tunnel_status.set("Stopped")
                self.log(f"❌ Tunnel not active (HTTP {response.status_code})")
        except requests.exceptions.Timeout:
            self.tunnel_status.set("Stopped")
            self.log("❌ Tunnel check timed out - tunnel is not active")
        except requests.exceptions.ConnectionError:
            self.tunnel_status.set("Stopped")
            self.log("❌ Cannot connect to tunnel - tunnel is not active")
        except Exception as e:
            self.tunnel_status.set("Stopped")
            self.log(f"❌ Tunnel check failed: {e}")

    def launch_bulk_uploader(self):
        """Launch the bulk image uploader tool"""
        self.log("📸 Launching Bulk Image Uploader...")
        uploader_path = self.frontend_dir / "tools" / "bulk-image-uploader.py"

        if not uploader_path.exists():
            self.log(f"❌ Bulk uploader not found at: {uploader_path}")
            return

        try:
            # Launch in background without capturing output
            import sys
            python_exe = sys.executable
            subprocess.Popen([python_exe, str(uploader_path)],
                           cwd=self.frontend_dir / "tools",
                           creationflags=subprocess.CREATE_NEW_CONSOLE if os.name == 'nt' else 0)
            self.log("✅ Bulk Image Uploader launched in new window")
        except Exception as e:
            self.log(f"❌ Failed to launch uploader: {e}")

    def load_config(self):
        """Load configuration and check initial status"""
        self.log("TysonDrawsStuff Publishing Manager")
        self.log("=" * 50)
        self.load_saved_config()
        self.check_strapi_status()
        self.update_image_stats()

        # Check current git branch and ensure we're on preview for preview workflow
        current_branch = self.get_current_branch()
        if current_branch and current_branch != 'preview':
            self.log(f"⚠️ Currently on '{current_branch}' branch")
            self.log("💡 Switch to 'preview' branch before making changes for preview")

    def on_closing(self):
        """Handle application closing"""
        if self.strapi_process:
            self.strapi_process.terminate()
        if self.tunnel_process:
            self.tunnel_process.terminate()
        self.root.destroy()

def main():
    root = tk.Tk()

    # Import for dialog
    import tkinter.simpledialog
    tk.simpledialog = tkinter.simpledialog

    app = PublishManager(root)
    root.protocol("WM_DELETE_WINDOW", app.on_closing)
    root.mainloop()

if __name__ == "__main__":
    main()