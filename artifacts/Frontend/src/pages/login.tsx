import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { User, Lock, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const { data: user, isLoading: isLoadingUser } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), retry: false },
  });
  const loginMutation = useLogin();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  useEffect(() => {
    if (user && !isLoadingUser) setLocation("/dashboard");
  }, [user, isLoadingUser, setLocation]);

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate({ data: values }, {
      onSuccess: () => setLocation("/dashboard"),
    });
  }

  const handleForgotPassword = () => {
    toast({
      title: "Reset Password Required",
      description: "Please contact your system administrator at admin@genops.com to reset your credentials.",
      variant: "default",
    });
  };

  if (isLoadingUser) return null;

  return (
    <div className="min-h-[100dvh] flex" style={{ background: "#efebe4" }}>
      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-100 p-12 shadow-2xl relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsla(200, 8%, 7%, 1.00) 0%, #0C5179 100%)" }}>
        {/* Decorative subtle background shapes */}
        <div className="absolute top-[-20%] right-[-20%] w-80 h-80 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-10%] w-80 h-80 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="flex items-center gap-3 relative z-10">
          <img src="/genops-logo.png" alt="GenOps.Live" className="h-16 w-auto object-contain rounded-[10%] bg-white p-1.5 shadow-lg shadow-orange-500/20" />
        </div>

        <div className="relative z-10 my-auto py-12">
          <h2 className="text-white text-4xl font-extrabold leading-tight mb-4 tracking-tight">
            Generator Management System<br />& Operations
          </h2>
          <p className="text-white text-sm leading-relaxed mb-8 max-w-sm">
            Track, manage, and monitor generator records in real-time. Every entry is automatically synced directly to your secure Google Sheet.
          </p>
        </div>

        <div className="text-slate-500 text-xs relative z-10">
          &copy; {new Date().getFullYear()} GenOps. All rights reserved.
          <br />Software Developed by <span className="text-orange-500 font-bold">Abhishek Prasad</span>
        </div>
      </div>

      {/* Right login form */}
      <div
        className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-12 relative overflow-hidden"
        style={{
          backgroundColor: "#f7f2ea",
          backgroundImage: `
            radial-gradient(circle at 75% 25%, rgba(255, 140, 0, 0.28) 0%, transparent 55%),
            radial-gradient(circle at 25% 75%, rgba(12, 81, 121, 0.22) 0%, transparent 55%),
            radial-gradient(circle at 50% 50%, rgba(255, 108, 0, 0.15) 0%, transparent 50%),
            radial-gradient(circle, rgba(255, 108, 0, 0.3) 1.5px, transparent 1.5px),
            radial-gradient(circle, rgba(12, 81, 121, 0.3) 1.5px, transparent 1.5px)
          `,
          backgroundSize: "100% 100%, 100% 100%, 100% 100%, 24px 24px, 48px 48px",
          backgroundPosition: "0 0, 0 0, 0 0, 0 0, 12px 12px",
        }}
      >
        {/* Ambient Glowing Orbs for dramatic Glassmorphism effect */}
        <div className="absolute top-[15%] right-[10%] w-72 h-72 rounded-full bg-orange-400/30 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[10%] left-[10%] w-80 h-80 rounded-full bg-orange-500/25 blur-3xl pointer-events-none" />
        <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-cyan-600/15 blur-3xl pointer-events-none" />

        <div
          className="w-full max-w-md bg-white/40 backdrop-blur-2xl border border-white/80 rounded-2xl shadow-2xl shadow-orange-950/10 p-6 sm:p-8 md:p-10 transition-all hover:shadow-orange-950/20 relative z-10"
          style={{
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
          }}
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <img src="/genops-logo.png" alt="GenOps.Live" className="h-10 w-auto object-contain rounded-[10%]" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1.5" style={{ color: "#1f1f2e" }}>Login</h1>
          <p className="text-sm mb-6 sm:mb-8 font-medium" style={{ color: "#6b7280" }}>Sign in to manage your genset assets</p>

          {loginMutation.isError && (
            <div className="mb-6 px-4.5 py-3.5 rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center gap-2" style={{ background: "#faf6f638", color: "#cf1322", border: "1px solid #ffa39e" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
              Invalid username or password
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold text-gray-700">Username</FormLabel>
                    <FormControl>
                      <div className="relative group">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 transition-colors group-focus-within:text-orange-500 z-10">
                          <User className="w-4.5 h-4.5" />
                        </span>
                        <Input
                          placeholder="Enter your username"
                          className="pl-10 h-12 sm:h-11 border-white/60 focus:border-orange-500 focus:ring-orange-500 bg-white/50 backdrop-blur-md rounded-lg transition-all focus:bg-white/80 focus:shadow-sm text-base sm:text-sm text-gray-900 placeholder:text-gray-500"
                          data-testid="input-username"
                          {...field}
                        />
                      </div>
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
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-sm font-semibold text-gray-700">Password</FormLabel>
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline transition-colors cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <FormControl>
                      <div className="relative group">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 transition-colors group-focus-within:text-orange-500 z-10">
                          <Lock className="w-4.5 h-4.5" />
                        </span>
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          className="pl-10 pr-10 h-12 sm:h-11 border-white/60 focus:border-orange-500 focus:ring-orange-500 bg-white/50 backdrop-blur-md rounded-lg transition-all focus:bg-white/80 focus:shadow-sm text-base sm:text-sm text-gray-900 placeholder:text-gray-500"
                          data-testid="input-password"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors focus:outline-none cursor-pointer z-10"
                        >
                          {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full h-12 sm:h-11 font-bold text-white rounded-lg transition-all shadow-md hover:shadow-lg shadow-orange-500/10 hover:shadow-orange-500/20 active:scale-[0.98] cursor-pointer text-base sm:text-sm"
                style={{ background: "#ff6c00" }}
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                {loginMutation.isPending ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </Form>

          <p className="text-center text-sm mt-8 text-gray-500 font-medium">
            Don't have an account?{" "}
            <Link href="/register" className="font-bold hover:underline transition-colors" style={{ color: "#ff6c00" }}>
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
