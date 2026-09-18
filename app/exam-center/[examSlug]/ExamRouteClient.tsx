"use client";

import { useRouter } from "next/navigation";

import ToeflMockTestClient from "../../speaking-test/toefl-mock/ToeflMockTestClient";

export default function ExamRouteClient() {
  const router = useRouter();

  return (
    <ToeflMockTestClient
      onExit={() => {
        router.push("/exam-center");
      }}
    />
  );
}
