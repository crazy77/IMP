"use client";

import { signInAction } from "./actions";

export default function SignInButton() {
  return (
    <form action={signInAction}>
      <button
        type="submit"
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Google로 시작하기
      </button>
    </form>
  );
}

