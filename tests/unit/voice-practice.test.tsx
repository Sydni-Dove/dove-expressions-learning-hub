import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import SubmissionForm from "@/components/SubmissionForm";
import FeedbackForm from "@/components/FeedbackForm";

const mocks = vi.hoisted(() => ({ save: vi.fn(), insert: vi.fn(), update: vi.fn(), rpc: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({
  rpc: mocks.rpc,
  from: () => ({
    upsert: mocks.save,
    insert: (payload: unknown) => { mocks.insert(payload); return { select: () => ({ single: async () => ({ data: { id: "attempt" }, error: null }) }) }; },
    update: (payload: unknown) => { mocks.update(payload); return { eq: () => ({ select: () => ({ single: async () => ({ data: { id: "attempt" }, error: null }) }) }) }; }
  })
}) }));

beforeEach(() => { cleanup(); vi.clearAllMocks(); mocks.save.mockResolvedValue({error:null}); mocks.rpc.mockResolvedValue({error:null}); });
const props = { assignmentId:"assignment", studentId:"student", steps:["Warm up", "Record the phrase"] };

describe("Voice practice", () => {
  it("saves a draft and restores the saved fields after remount", async () => {
    const view = render(<SubmissionForm {...props}/>);
    fireEvent.click(screen.getByLabelText("Warm up"));
    fireEvent.change(screen.getByLabelText("Practice minutes"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Practice reflection"), { target: { value: "Breathing felt easier." } });
    fireEvent.click(screen.getByRole("button", {name:"Save progress"}));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Progress saved"));
    const draft = mocks.save.mock.calls[0][0];
    expect(draft).toMatchObject({ assignment_id:"assignment", student_id:"student", minutes:12, checked_steps:[0], response:"Breathing felt easier." });
    expect(mocks.insert).not.toHaveBeenCalled();
    view.unmount();
    render(<SubmissionForm {...props} draft={draft}/>);
    expect(screen.getByLabelText("Warm up")).toBeChecked();
    expect(screen.getByLabelText("Record the phrase")).not.toBeChecked();
    expect(screen.getByLabelText("Practice reflection")).toHaveValue("Breathing felt easier.");
    expect(screen.getByLabelText("Practice minutes")).toHaveValue(12);
  });
  it("requires the assigned steps before submitting", async () => {
    render(<SubmissionForm {...props}/>);
    fireEvent.change(screen.getByLabelText("Practice reflection"), {target:{value:"My practice"}});
    fireEvent.click(screen.getByRole("button",{name:"Submit practice"}));
    expect(screen.getByRole("alert")).toHaveTextContent("Complete each practice step");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("revises the existing returned attempt", async () => {
    render(<SubmissionForm {...props} draft={{checked_steps:[0,1],minutes:10,response:"Improved phrase",recording_url:""}} attempt={{id:"existing",status:"returned",content:{response:"First phrase"},file_urls:[]}}/>);
    fireEvent.click(screen.getByRole("button",{name:"Resubmit practice"}));
    await waitFor(()=>expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({status:"revised"})));
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("retains unsaved work and reports a save failure", async () => {
    mocks.save.mockResolvedValue({error:{message:"Connection failed"}});
    render(<SubmissionForm {...props}/>);
    fireEvent.change(screen.getByLabelText("Practice reflection"), {target:{value:"Keep this reflection"}});
    fireEvent.click(screen.getByRole("button",{name:"Save progress"}));
    await waitFor(()=>expect(screen.getByRole("alert")).toHaveTextContent("Connection failed"));
    expect(screen.getByLabelText("Practice reflection")).toHaveValue("Keep this reflection");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("disables saving in staff preview", () => {
    render(<SubmissionForm {...props} preview/>);
    expect(screen.getByLabelText("Practice reflection")).toBeDisabled();
    expect(screen.queryByRole("button",{name:"Submit practice"})).toBeNull();
  });
});

it("publishes feedback and review outcome through one atomic operation", async () => {
  render(<FeedbackForm submissionId="attempt"/>);
  fireEvent.change(screen.getByLabelText("Feedback shared with the student"), {target:{value:"Keep your shoulders relaxed."}});
  fireEvent.change(screen.getByLabelText("Update status to"), {target:{value:"returned"}});
  fireEvent.click(screen.getByRole("button",{name:"Send feedback"}));
  await waitFor(()=>expect(mocks.rpc).toHaveBeenCalledWith("dp_review_submission", {target_id:"attempt",feedback_text:"Keep your shoulders relaxed.",next_status:"returned"}));
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
});
