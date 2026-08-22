"""Silent auto-updater. Run with pythonw.exe for no window."""
import subprocess, os, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))
subprocess.run([sys.executable, "scraper/scraper.py"], capture_output=True)
if os.path.exists("public/data/latest.json"):
    subprocess.run(["git", "add", "public/data/latest.json"], capture_output=True)
    subprocess.run(["git", "commit", "-m", "Auto update"], capture_output=True)
    subprocess.run(["git", "pull", "--rebase"], capture_output=True)
    subprocess.run(["git", "push"], capture_output=True)
