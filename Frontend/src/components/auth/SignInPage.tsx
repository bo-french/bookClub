import { SignIn } from "@clerk/clerk-react";

export function SignInPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <SignIn routing="path" path="/sign-in" />
    </div>
  );
}
