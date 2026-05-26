import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { createRegistrationRequest } from "@/lib/queries";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** POST /api/auth/register — files a registration_request for admin review. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const data = body as Record<string, unknown>;
  const email = typeof data.email === "string" ? data.email.trim() : "";
  const password = typeof data.password === "string" ? data.password : "";
  const fullName =
    typeof data.fullName === "string" ? data.fullName.trim() : "";
  const studentId =
    typeof data.studentId === "string" && data.studentId.trim()
      ? data.studentId.trim()
      : null;
  const courseId =
    typeof data.courseId === "string" && data.courseId.trim()
      ? data.courseId.trim()
      : null;
  const yearRaw =
    typeof data.year === "number"
      ? data.year
      : typeof data.year === "string"
        ? Number.parseInt(data.year, 10)
        : null;
  const year =
    yearRaw !== null && Number.isFinite(yearRaw) && yearRaw >= 1 && yearRaw <= 5
      ? yearRaw
      : null;

  if (!email || !password || !fullName) {
    return NextResponse.json(
      { error: "Email, password, and full name are required." },
      { status: 400 },
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "That email address doesn't look right." },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await createRegistrationRequest({
      email,
      passwordHash,
      fullName,
      studentId,
      courseId,
      year,
    });
    if ("duplicate" in result) {
      if (result.duplicate === "email") {
        return NextResponse.json(
          { error: "An account with that email already exists." },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: "That student ID is already in use." },
        { status: 409 },
      );
    }
    if ("invalidCourse" in result) {
      return NextResponse.json(
        { error: "Select a course from the list." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, id: result.id });
  } catch (err) {
    console.error("[register] failed:", err);
    return NextResponse.json(
      { error: "Could not submit the registration request." },
      { status: 500 },
    );
  }
}
