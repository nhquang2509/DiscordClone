'use client';

import { AuthPage } from '@/app/components/AuthPage';
import { Toaster } from 'sonner';

export default function AuthRoute() {
  return (
    <>
      <AuthPage />
      <Toaster richColors position="top-center" />
    </>
  );
}
