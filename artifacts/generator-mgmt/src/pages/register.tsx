import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegister, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

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
    defaultValues: {
      username: "",
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (user && !isLoadingUser) {
      setLocation("/dashboard");
    }
  }, [user, isLoadingUser, setLocation]);

  function onSubmit(values: z.infer<typeof registerSchema>) {
    registerMutation.mutate({ data: values }, {
      onSuccess: () => {
        setLocation("/dashboard");
      }
    });
  }

  if (isLoadingUser) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />
      <Card className="w-full max-w-md border-border/50 bg-card/50 backdrop-blur-xl shadow-2xl relative z-10">
        <CardHeader className="space-y-3 pb-6">
          <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-2 mx-auto border border-primary/30">
            <Activity className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-center tracking-tight font-mono">GEN_OPS</CardTitle>
          <CardDescription className="text-center text-muted-foreground font-mono text-sm uppercase tracking-wider">
            Operator Registration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Desired Operator ID</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter username" className="font-mono bg-background/50" {...field} />
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
                    <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Comms Link (Email)</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Enter email" className="font-mono bg-background/50" {...field} />
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
                    <FormLabel className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Access Code</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Create password" className="font-mono bg-background/50" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full font-mono uppercase tracking-wider mt-4" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? "Registering..." : "Request Clearance"}
              </Button>
            </form>
          </Form>
          <div className="mt-6 text-center text-sm font-mono">
            <span className="text-muted-foreground">Existing operator? </span>
            <Link href="/login" className="text-primary hover:text-primary/80 transition-colors underline decoration-primary/30 underline-offset-4">
              Return to login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
