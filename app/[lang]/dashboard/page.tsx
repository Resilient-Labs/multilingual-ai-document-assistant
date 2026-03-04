"use client";
import axios from "axios";
import { useEffect } from "react";

export default function Page() {
  useEffect(() => {
    axios.post("/api/translation", {
      text: "Hello, world!",
    }).then((res) => {
      console.log(res.data);
    });
  }, []);

  return (
    <div className="flex h-screen">
      <div className="flex-1">
        Left
      </div>
      <div className="flex-1">
        Right
      </div>
    </div>
  );
}
