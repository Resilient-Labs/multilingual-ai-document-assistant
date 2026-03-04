"use client";
import Image from "next/image";
import axios from "axios";
import { useEffect } from "react";
export default function Home() {

  useEffect(() => {
    axios.post("/api/translation", {
      text: "Hello, world!",
    }).then((res) => {
      console.log(res.data);
    });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
    </div>
  );
}
