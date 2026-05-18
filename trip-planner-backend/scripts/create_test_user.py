import os
import sys
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables from current or parent directories
load_dotenv(".env")
load_dotenv("../.env")

def create_test_user():
    url = os.getenv("SUPABASE_URL")
    # Use SUPABASE_KEY (ideally service role key for admin privileges)
    key = os.getenv("SUPABASE_KEY")

    if not url or not key:
        print("Error: SUPABASE_URL and SUPABASE_KEY must be set in your .env file.")
        sys.exit(1)

    print(f"Connecting to Supabase at: {url}")
    supabase = create_client(url, key)

    email = "dubeypriyansh12321@gmail.com"
    password = "asdf123"

    print(f"Attempting to create and auto-confirm test user: {email}...")

    # Method 1: Try using Supabase Admin API (requires service_role key)
    try:
        res = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True, # Auto-confirm email!
            "user_metadata": {"full_name": "Priyansh Dubey (Admin)"}
        })
        print("\n🎉 Success! User created and auto-confirmed via Supabase Admin API.")
        print(f"Email: {email}")
        print(f"Password: {password}")
        return
    except Exception as admin_err:
        print(f"Admin API signup did not succeed (expected if using anon key): {admin_err}")
        print("Falling back to standard user signup...")

    # Method 2: Fallback to standard signup (requires Email confirmations disabled in Supabase dashboard)
    try:
        res = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {
                "data": {
                    "full_name": "Priyansh Dubey"
                }
            }
        })
        print("\n🎉 Success! User signup request submitted successfully.")
        print(f"Email: {email}")
        print("Note: If you get a 'login failed' error, make sure 'Confirm email' is disabled in your Supabase Auth dashboard.")
    except Exception as signup_err:
        print(f"Standard signup failed: {signup_err}")
        sys.exit(1)

if __name__ == "__main__":
    create_test_user()
