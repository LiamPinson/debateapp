import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

/**
 * POST /api/auth/oauth-profile-complete
 * Finalizes new OAuth user profiles after customization.
 *
 * FormData:
 *   - username (string): chosen username (3-20 chars, alphanumeric + underscore)
 *   - avatar (File, optional): image file to upload
 *   - avatarUrl (string, optional): external avatar URL from OAuth provider
 *
 * Headers:
 *   - Authorization: Bearer {accessToken} - Supabase OAuth access token
 */
export async function POST(request) {
  try {
    // Get the OAuth access token from Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    const accessToken = authHeader.slice(7); // Remove "Bearer " prefix
    const db = createServiceClient();

    // Verify the access token and get the authenticated user
    const { data: { user: supabaseUser }, error: authError } = await db.auth.getUser(accessToken);
    if (authError || !supabaseUser) {
      return NextResponse.json(
        { error: "Invalid or expired access token" },
        { status: 401 }
      );
    }

    // Parse FormData
    const formData = await request.formData();
    const username = formData.get("username");
    const avatarFile = formData.get("avatar");
    const avatarUrl = formData.get("avatarUrl");

    // Validate username
    if (!username || username.length < 3 || username.length > 20) {
      return NextResponse.json(
        { error: "Username must be 3-20 characters" },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        { error: "Username can only contain letters, numbers, and underscores" },
        { status: 400 }
      );
    }

    // Check username uniqueness
    const { data: existingUser } = await db
      .from("users")
      .select("id")
      .eq("username", username)
      .limit(1);

    if (existingUser && existingUser.length > 0) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 }
      );
    }

    let finalAvatarUrl = avatarUrl || null;

    // Handle avatar file upload if provided
    if (avatarFile) {
      try {
        const bytes = await avatarFile.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const fileExtension = avatarFile.type.includes("jpeg") ? "jpg" : "png";
        const filename = `avatar-${supabaseUser.id}-${uuidv4()}.${fileExtension}`;

        // Ensure avatars directory exists
        const avatarDir = join(process.cwd(), "public", "avatars");
        await mkdir(avatarDir, { recursive: true });

        // Write file to disk
        const filepath = join(avatarDir, filename);
        await writeFile(filepath, buffer);

        finalAvatarUrl = `/avatars/${filename}`;
      } catch (uploadError) {
        console.error("Avatar upload error:", uploadError);
        return NextResponse.json(
          { error: "Failed to upload avatar" },
          { status: 500 }
        );
      }
    }

    // Look up the user by auth_id (created during /api/auth/oauth)
    const { data: user, error: userError } = await db
      .from("users")
      .select("id")
      .eq("auth_id", supabaseUser.id)
      .single();

    if (userError || !user) {
      console.error("User lookup error:", userError);
      return NextResponse.json(
        { error: "User not found. Complete OAuth flow first." },
        { status: 404 }
      );
    }

    // Update user profile with username and avatar
    const { error: updateError } = await db
      .from("users")
      .update({
        username: username,
        avatar_url: finalAvatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Profile update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("OAuth profile completion error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to complete profile" },
      { status: 500 }
    );
  }
}
