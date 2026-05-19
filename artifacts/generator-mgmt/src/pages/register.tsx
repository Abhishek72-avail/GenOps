import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegister, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Zap } from "lucide-react";

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: isLoadingUser } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false },
  });
  const registerMutation = useRegister();

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", email: "", password: "" },
  });

  useEffect(() => {
    if (user && !isLoadingUser) setLocation("/dashboard");
  }, [user, isLoadingUser, setLocation]);

  function onSubmit(values: z.infer<typeof registerSchema>) {
    registerMutation.mutate({ data: values }, {
      onSuccess: () => setLocation("/dashboard"),
    });
  }

  if (isLoadingUser) return null;

  return (
    <div className="min-h-screen flex" style={{ background: "#f0ede8" }}>
      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-96 p-10" style={{ background: "#1f1f2e" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "#ff6c00" }}>
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">GenOps</span>
        </div>
        <div>
          <h2 className="text-white text-3xl font-bold leading-snug mb-3">
            Create your<br />operator account
          </h2>
          <p style={{ color: "#9ca3af" }} className="text-sm leading-relaxed">
            Join the team and get full access to the generator management dashboard and real-time Google Sheets sync.
          </p>
        </div>
        <div style={{ color: "#6b7280" }} className="text-xs">
          &copy; {new Date().getFullYear()} GenOps. All rights reserved.
        </div>
      </div>

      {/* Right register form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#ff6c00" }}>
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-xl" style={{ color: "#1f1f2e" }}>GenOps</span>
          </div>

          <h1 className="text-2xl font-bold mb-1" style={{ color: "#1f1f2e" }}>Create account</h1>
          <p className="text-sm mb-8" style={{ color: "#6b7280" }}>Fill in your details to get started</p>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {registerMutation.isError && (
              <div className="mb-4 px-4 py-3 rounded-lg text-sm font-medium" style={{ background: "#fff1f0", color: "#cf1322", border: "1px solid #ffa39e" }}>
                Username already taken. Try a different one.
              </div>
            )}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium" style={{ color: "#374151" }}>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="Choose a username" className="h-10 bg-white border-gray-300" data-testid="input-username" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium" style={{ color: "#374151" }}>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Enter your email" className="h-10 bg-white border-gray-300" data-testid="input-email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium" style={{ color: "#374151" }}>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Create a password (min 6 chars)" className="h-10 bg-white border-gray-300" data-testid="input-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full h-10 font-semibold text-white rounded-lg"
                  style={{ background: "#ff6c00" }}
                  disabled={registerMutation.isPending}
                  data-testid="button-register"
                >
                  {registerMutation.isPending ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </Form>
          </div>

          <p className="text-center text-sm mt-6" style={{ color: "#6b7280" }}>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold" style={{ color: "#ff6c00" }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
