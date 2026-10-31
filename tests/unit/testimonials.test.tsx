import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import VoiceReviewForm from "@/components/VoiceReviewForm";
import VoiceReviewModeration from "@/components/VoiceReviewModeration";

const mocks = vi.hoisted(() => ({ upload: vi.fn(), insert: vi.fn(), update: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({
  storage: { from: (b: string) => ({ upload: (...a: unknown[]) => mocks.upload(b, ...a) }) },
  from: () => ({ insert: mocks.insert, update: (p: unknown) => ({ eq: (...a: unknown[]) => mocks.update(p, ...a) }) })
}) }));
beforeEach(() => { cleanup(); vi.clearAllMocks(); mocks.upload.mockResolvedValue({ error: null }); mocks.insert.mockResolvedValue({ error: null }); mocks.update.mockResolvedValue({ error: null }); });

const pickVideo = (name = "story.mp4", type = "video/mp4") =>
  fireEvent.change(screen.getByLabelText(/Video testimonial/), { target: { files: [new File([new Uint8Array(100)], name, { type })] } });

describe("testimonial submission", () => {
  it("uploads video privately, never grants public use unless explicitly checked", async () => {
    render(<VoiceReviewForm studentId="stu1" />);
    pickVideo();
    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));
    await waitFor(() => expect(mocks.insert).toHaveBeenCalled());
    expect(mocks.upload.mock.calls[0][0]).toBe("voice-testimonials");
    expect(mocks.upload.mock.calls[0][1]).toMatch(/^stu1\/\d+-story\.mp4$/);
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({ student_id: "stu1", allow_public_use: false, status: "pending", video_path: mocks.upload.mock.calls[0][1] });
  });
  it("records explicit consent only when checked", async () => {
    render(<VoiceReviewForm studentId="stu1" />);
    fireEvent.change(screen.getByLabelText(/Your experience/), { target: { value: "My voice grew." } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));
    await waitFor(() => expect(mocks.insert).toHaveBeenCalled());
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({ allow_public_use: true, status: "pending" });
    expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty("published_at");
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("rejects non-video files and empty submissions", async () => {
    render(<VoiceReviewForm studentId="stu1" />);
    pickVideo("notes.pdf", "application/pdf");
    expect(await screen.findByRole("alert")).toHaveTextContent("video");
    fireEvent.click(screen.getByRole("button", { name: "Submit for review" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("written testimonial or a video");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});

describe("testimonial moderation", () => {
  const base = { id: "t1", review_text: "Great", video_url: null, allow_public_use: true, created_at: "2026-10-01T00:00:00Z", published_at: null };
  it("offers publishing only for approved, consented testimonials", () => {
    const { rerender } = render(<VoiceReviewModeration reviews={[{ ...base, status: "pending" }]} />);
    expect(screen.queryByRole("button", { name: "Mark as published" })).toBeNull();
    rerender(<VoiceReviewModeration reviews={[{ ...base, status: "approved", allow_public_use: false }]} />);
    expect(screen.queryByRole("button", { name: "Mark as published" })).toBeNull();
    rerender(<VoiceReviewModeration reviews={[{ ...base, status: "approved" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark as published" }));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ published_at: expect.any(String) }), "id", "t1");
  });
  it("rejects with a status change only", () => {
    render(<VoiceReviewModeration reviews={[{ ...base, status: "pending" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: "declined" }), "id", "t1");
  });
});
