'use client';

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface AuthFormData {
  email: string;
  password: string;
  username?: string;
}

export function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AuthFormData>();

  const switchTab = (next: "login" | "register") => {
    setTab(next);
    reset();
  };

  const onSubmit = async (data: AuthFormData) => {
    setIsLoading(true);

    if (tab === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Logged in successfully!");
        router.push('/channels');
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            username: data.username ?? data.email.split("@")[0],
          },
        },
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Registered successfully! Please log in.");
        switchTab("login");
      }
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#313338]">
      <div className="w-full max-w-md rounded-md bg-[#2b2d31] shadow-xl p-8 space-y-6">

        {/* Logo + Tiêu đề */}
        <div className="text-center space-y-1">
          <div className="text-5xl mb-3">🎮</div>
          <h1 className="text-2xl font-bold text-white">
            {tab === "login" ? "Welcome back!" : "Create an account"}
          </h1>
          <p className="text-[#b5bac1] text-sm">
            {tab === "login"
              ? "We're so excited to see you again!"
              : "Join the Discord Clone community"}
          </p>
        </div>

        {/* Tab Đăng nhập / Đăng ký */}
        <div className="flex rounded-md overflow-hidden border border-[#1e1f22]">
          <button
            type="button"
            onClick={() => switchTab("login")}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              tab === "login"
                ? "bg-[#5865f2] text-white"
                : "bg-[#1e1f22] text-[#b5bac1] hover:text-white"
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => switchTab("register")}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              tab === "register"
                ? "bg-[#5865f2] text-white"
                : "bg-[#1e1f22] text-[#b5bac1] hover:text-white"
            }`}
          >
            Register
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          {/* Username — chỉ hiện khi đăng ký */}
          {tab === "register" && (
            <div className="space-y-1.5">
              <Label className="text-[#b5bac1] text-xs font-bold uppercase tracking-wide">
                Username
              </Label>
              <Input
                placeholder="your_name"
                className="bg-[#1e1f22] border-[#1e1f22] text-white placeholder:text-[#6d6f78] focus-visible:border-[#5865f2]"
                {...register("username", {
                  required: "Please enter a username",
                  minLength: { value: 2, message: "Minimum 2 characters" },
                })}
              />
              {errors.username && (
                <p className="text-red-400 text-xs">{errors.username.message}</p>
              )}
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <Label className="text-[#b5bac1] text-xs font-bold uppercase tracking-wide">
              Email
            </Label>
            <Input
              type="email"
              placeholder="you@example.com"
              className="bg-[#1e1f22] border-[#1e1f22] text-white placeholder:text-[#6d6f78] focus-visible:border-[#5865f2]"
              {...register("email", {
                required: "Please enter your email",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Invalid email address",
                },
              })}
            />
            {errors.email && (
              <p className="text-red-400 text-xs">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label className="text-[#b5bac1] text-xs font-bold uppercase tracking-wide">
              Password
            </Label>
            <Input
              type="password"
              placeholder="••••••••"
              className="bg-[#1e1f22] border-[#1e1f22] text-white placeholder:text-[#6d6f78] focus-visible:border-[#5865f2]"
              {...register("password", {
                required: "Please enter your password",
                minLength: { value: 6, message: "Password must be at least 6 characters" },
              })}
            />
            {errors.password && (
              <p className="text-red-400 text-xs">{errors.password.message}</p>
            )}
          </div>

          {/* Nút submit */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#5865f2] hover:bg-[#4752c4] text-white font-medium h-10"
          >
            {isLoading
              ? "Logging in..."
              : tab === "login"
              ? "Log In"
              : "Create Account"}
          </Button>
        </form>

        {/* Footer link */}
        <p className="text-center text-sm text-[#b5bac1]">
          {tab === "login" ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => switchTab(tab === "login" ? "register" : "login")}
            className="text-[#00a8fc] hover:underline"
          >
            {tab === "login" ? "Register now" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}
