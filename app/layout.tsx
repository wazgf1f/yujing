import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "语镜 · 外语语用得体性教练",
  description:
    "不止纠语法，更纠「说得不像母语者」。面向外语学习者的语境化表达诊断工具，从语法、地道、得体、改写四层打磨你的外语表达。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <div
          className="bg-blob"
          style={{ width: 440, height: 440, top: -120, left: -120, background: "rgba(99,102,241,0.28)" }}
        />
        <div
          className="bg-blob"
          style={{ width: 520, height: 520, top: "15%", right: -180, background: "rgba(168,85,247,0.24)", animationDelay: "-7s" }}
        />
        <div
          className="bg-blob"
          style={{ width: 380, height: 380, bottom: -140, left: "32%", background: "rgba(236,72,153,0.18)", animationDelay: "-13s" }}
        />
        {children}
      </body>
    </html>
  );
}
