import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import SubmissionForm from "@/components/SubmissionForm";
import RecordingPlayer from "@/components/RecordingPlayer";
import { validateMediaFile, recordingPath, recordingRef, isUploadedRecording, safeFileName, MAX_RECORDING_BYTES } from "@/lib/recordings";

const mocks = vi.hoisted(() => ({ upload: vi.fn(), sign: vi.fn(), save: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({
  from: () => ({ upsert: mocks.save }),
  storage: { from: (bucket: string) => ({ upload: (...a: unknown[]) => mocks.upload(bucket, ...a), createSignedUrl: mocks.sign }) }
}) }));
beforeEach(() => { cleanup(); vi.clearAllMocks(); mocks.save.mockResolvedValue({ error: null }); mocks.upload.mockResolvedValue({ error: null }); mocks.sign.mockResolvedValue({ data: { signedUrl: "https://signed.example/x" }, error: null }); });

describe("recording validation", () => {
  const file = (name: string, type: string, size = 1000) => ({ name, type, size });
  it("accepts phone audio/video and rejects other media or oversize files", () => {
    expect(validateMediaFile(file("take.m4a", "audio/x-m4a"))).toBeNull();
    expect(validateMediaFile(file("take.mov", "video/quicktime"))).toBeNull();
    expect(validateMediaFile(file("take.mp3", "audio/mpeg"))).toBeNull();
    expect(validateMediaFile(file("page.html", "text/html"))).toMatch(/audio or video/);
    expect(validateMediaFile(file("take.mp3", "text/html"))).toMatch(/audio or video/);
    expect(validateMediaFile(file("take.exe", "audio/mpeg"))).toMatch(/audio or video/);
    expect(validateMediaFile(file("big.mp4", "video/mp4", MAX_RECORDING_BYTES + 1))).toMatch(/limit is 50 MB/);
    expect(validateMediaFile(file("empty.mp3", "audio/mpeg", 0))).toMatch(/empty/);
  });
  it("builds only student/assignment-scoped paths with safe names", () => {
    expect(recordingPath("s1", "a1", "../my song?.m4a", 5)).toBe("s1/a1/5-_my_song_.m4a".replace("_my", "_my"));
    expect(recordingPath("s1", "a1", "x.m4a", 5).split("/")).toHaveLength(3);
    expect(safeFileName("../../etc/passwd")).not.toContain("/");
    expect(isUploadedRecording(recordingRef("s1/a1/5-x.m4a"))).toBe(true);
    expect(isUploadedRecording("https://example.com/x.m4a")).toBe(false);
    expect(isUploadedRecording("storage://course-media-private/x")).toBe(false);
  });
});

describe("private recording upload in practice", () => {
  const props = { assignmentId: "assign1", studentId: "stud1", steps: [] as string[] };
  const pick = (name: string, type: string, size = 2048) => {
    const input = screen.getByLabelText(/Record or upload your singing/) as HTMLInputElement;
    const f = new File([new Uint8Array(size)], name, { type });
    fireEvent.change(input, { target: { files: [f] } });
  };
  it("uploads to the private bucket under the student's own folder and keeps a storage reference", async () => {
    render(<SubmissionForm {...props} />);
    pick("verse.m4a", "audio/x-m4a");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("uploaded privately"));
    const [bucket, path, , options] = mocks.upload.mock.calls[0];
    expect(bucket).toBe("voice-recordings");
    expect(path).toMatch(/^stud1\/assign1\/\d+-verse\.m4a$/);
    expect(options).toMatchObject({ upsert: false, contentType: "audio/x-m4a" });
    fireEvent.click(screen.getByRole("button", { name: "Save progress" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.save.mock.calls[0][0].recording_url).toBe(`storage://voice-recordings/${path}`);
  });
  it("blocks a bad file before any network call", async () => {
    render(<SubmissionForm {...props} />);
    pick("notes.pdf", "application/pdf");
    expect(await screen.findByRole("alert")).toHaveTextContent("audio or video");
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("reports upload failures and keeps the link workflow available", async () => {
    mocks.upload.mockResolvedValue({ error: { message: "Payload too large" } });
    render(<SubmissionForm {...props} />);
    pick("a.mp3", "audio/mpeg");
    expect(await screen.findByRole("alert")).toHaveTextContent("Payload too large");
    fireEvent.change(screen.getByLabelText(/paste a private recording link/), { target: { value: "https://example.com/rec" } });
    fireEvent.click(screen.getByRole("button", { name: "Save progress" }));
    await waitFor(() => expect(mocks.save.mock.calls[0][0].recording_url).toBe("https://example.com/rec"));
  });
  it("restores a saved upload and plays it back with a short-lived link", async () => {
    render(<SubmissionForm {...props} draft={{ checked_steps: [], minutes: 0, response: "", recording_url: "storage://voice-recordings/stud1/assign1/1-verse.m4a" }} />);
    expect(screen.getByText(/Private recording: verse.m4a/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Play back" }));
    await waitFor(() => expect(mocks.sign).toHaveBeenCalledWith("stud1/assign1/1-verse.m4a", 600));
  });
  it("renders instructor playback and a safe fallback", () => {
    const { container, rerender } = render(<RecordingPlayer label="Attempt 1" original="storage://voice-recordings/s/a/1-x.mp4" signedUrl="https://signed.example/v" />);
    expect(container.querySelector("video")).toBeTruthy();
    rerender(<RecordingPlayer label="Attempt 1" original="storage://voice-recordings/s/a/1-x.m4a" signedUrl="https://signed.example/a" />);
    expect(container.querySelector("audio")).toBeTruthy();
    rerender(<RecordingPlayer label="x" original="storage://voice-recordings/s/a/1-x.m4a" signedUrl="unavailable://denied" />);
    expect(screen.getByText("Recording unavailable.")).toBeInTheDocument();
  });
});
