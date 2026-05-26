"use client";

import { useState } from "react";
import { CheckCircle2, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  CourseCombobox,
  type CourseOption,
} from "@/components/cloudcampus/course-combobox";
import type { LookupRow } from "@/lib/lookups";

/** Registration form — posts to /api/auth/register. */
export function RegisterForm({ courses }: { courses: LookupRow[] }) {
  const courseOptions: CourseOption[] = courses.map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
          fullName: form.get("fullName"),
          studentId: form.get("studentId"),
          courseId: form.get("courseId"),
          year: form.get("year"),
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Registration failed. Please try again.");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Alert className="mt-6">
        <CheckCircle2 />
        <AlertDescription>
          Thanks — your application is in. You&apos;ll receive an email once
          an administrator has reviewed it.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" required disabled={submitting} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={submitting}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          disabled={submitting}
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="studentId">Student ID</Label>
          <Input id="studentId" name="studentId" disabled={submitting} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="year">Year level</Label>
          <NativeSelect id="year" name="year" disabled={submitting}>
            <NativeSelectOption value="">Select…</NativeSelectOption>
            <NativeSelectOption value="1">Year 1</NativeSelectOption>
            <NativeSelectOption value="2">Year 2</NativeSelectOption>
            <NativeSelectOption value="3">Year 3</NativeSelectOption>
            <NativeSelectOption value="4">Year 4</NativeSelectOption>
            <NativeSelectOption value="5">Alumnus</NativeSelectOption>
          </NativeSelect>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="course">Course</Label>
        <CourseCombobox
          courses={courseOptions}
          name="courseId"
          disabled={submitting}
        />
        <p className="text-xs text-muted-foreground">
          Search and pick from the list.
        </p>
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit application"}
      </Button>
    </form>
  );
}
