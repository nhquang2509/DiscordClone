'use client';

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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
        toast.success("Đăng nhập thành công!");
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
        toast.success("Đăng ký thành công! Kiểm tra email để xác nhận.");
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
            {tab === "login" ? "Chào mừng trở lại!" : "Tạo tài khoản"}
          </h1>
          <p className="text-[#b5bac1] text-sm">
            {tab === "login"
              ? "Chúng tôi rất vui khi gặp lại bạn!"
              : "Tham gia cộng đồng Discord Clone"}
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
            Đăng nhập
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
            Đăng ký
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          {/* Username — chỉ hiện khi đăng ký */}
          {tab === "register" && (
            <div className="space-y-1.5">
              <Label className="text-[#b5bac1] text-xs font-bold uppercase tracking-wide">
                Tên người dùng
              </Label>
              <Input
                placeholder="tên_của_bạn"
                className="bg-[#1e1f22] border-[#1e1f22] text-white placeholder:text-[#6d6f78] focus-visible:border-[#5865f2]"
                {...register("username", {
                  required: "Vui lòng nhập tên người dùng",
                  minLength: { value: 2, message: "Tối thiểu 2 ký tự" },
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
                required: "Vui lòng nhập email",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Email không hợp lệ",
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
              Mật khẩu
            </Label>
            <Input
              type="password"
              placeholder="••••••••"
              className="bg-[#1e1f22] border-[#1e1f22] text-white placeholder:text-[#6d6f78] focus-visible:border-[#5865f2]"
              {...register("password", {
                required: "Vui lòng nhập mật khẩu",
                minLength: { value: 6, message: "Mật khẩu tối thiểu 6 ký tự" },
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
              ? "Đang xử lý..."
              : tab === "login"
              ? "Đăng nhập"
              : "Tạo tài khoản"}
          </Button>
        </form>

        {/* Footer link */}
        <p className="text-center text-sm text-[#b5bac1]">
          {tab === "login" ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
          <button
            type="button"
            onClick={() => switchTab(tab === "login" ? "register" : "login")}
            className="text-[#00a8fc] hover:underline"
          >
            {tab === "login" ? "Đăng ký ngay" : "Đăng nhập"}
          </button>
        </p>
      </div>
    </div>
  );
}
