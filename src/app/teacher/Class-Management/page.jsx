"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";

export default function ClassManagementPage() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setMessage("");

      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || profile.role !== "teacher") {
        router.replace("/student/Dashboard");
        return;
      }

      const { data, error } = await supabase
        .from("courses")
        .select("id, code, title")
        .eq("teacher_id", user.id)
        .order("id", { ascending: true });

      if (error) setMessage(error.message);
      setCourses(data || []);
      setLoading(false);
    };

    run();
  }, [router]);

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;

  const createCourse = async (e) => {
    e.preventDefault();
    setMessage("");

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (!user) {
      setMessage("Please login first.");
      return;
    }

    if (!code.trim() || !title.trim()) {
      setMessage("Please enter course code and title.");
      return;
    }

    const { error } = await supabase.from("courses").insert([
      {
        code: code.trim(),
        title: title.trim(),
        teacher_id: user.id,
      },
    ]);

    if (error) {
      setMessage(error.message);
      return;
    }

    setCode("");
    setTitle("");
    setMessage("Course created!");
    loadCourses();
  };

  const loadCourses = async () => {
    setMessage("");
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (!user) return;

    const { data, error } = await supabase
      .from("courses")
      .select("id, code, title")
      .eq("teacher_id", user.id)
      .order("id", { ascending: true });

    if (error) setMessage(error.message);
    setCourses(data || []);
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ marginBottom: 12 }}>Class Management</h1>
        <LogoutButton />
      </div>

      <form onSubmit={createCourse} style={{ marginBottom: 16 }}>
        <input
          placeholder="Course Code (e.g., IT101)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <input
          placeholder="Course Title (e.g., Programming 1)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ marginRight: 8 }}
        />
        <button type="submit">Add Course</button>
      </form>

      {message && <p>{message}</p>}

      <h3 style={{ marginTop: 16 }}>My Courses</h3>
      {!courses.length ? (
        <p>No courses yet.</p>
      ) : (
        <ul>
          {courses.map((c) => (
            <li key={c.id}>
              <b>{c.code}</b> — {c.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}