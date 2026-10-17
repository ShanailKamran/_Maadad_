import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getCustomerJob } from "@/lib/jobs";
import { one } from "@/lib/db";
import { budgetText, dt } from "@/lib/format";
import { ActionForm, Submit } from "@/components/ActionForm";
import { publishJobAction, cancelJobAction } from "../../../actions";

export const metadata: Metadata = { title: "Preview job" };

export default async function Preview({ params }: { params: { id: string } }) {
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const job = await getCustomerJob(user, params.id);
  if (!job) notFound();
  if (job.status !== "draft") redirect(`/jobs/${job.id}`);
  const priv = await one<{ address_text: string }>("SELECT address_text FROM job_private WHERE job_id=$1", [job.id]);

  return (
    <div style={{ maxWidth: 680 }}>
      <h1>Preview your job</h1>
      <p className="lead">This is what workers will see. It is not live until you publish.</p>
      <article className="card">
        <h2 style={{ marginTop: 0 }}>{job.title}</h2>
        <p className="meta">{job.category} · {job.area}, Lahore · {job.asap ? "As soon as possible" : dt(job.preferred_at)}</p>
        <p style={{ whiteSpace: "pre-wrap" }}>{job.description}</p>
        <p><strong>Budget:</strong> {budgetText(job.budget_min, job.budget_max)}</p>
        {job.photo_ids.length > 0 && (
          <div className="photos">{job.photo_ids.map((id) => /* eslint-disable-next-line @next/next/no-img-element */ <img key={id} src={`/files/job-photo/${id}`} alt="Job photo" />)}</div>
        )}
      </article>
      <p className="notice"><strong>Private to the chosen worker only:</strong> {priv?.address_text}. Other workers see just &quot;{job.area}&quot;.</p>
      <p className="notice">By publishing you confirm the details are accurate. Payment is arranged directly with the worker you choose; we don&apos;t hold or guarantee payment or work.</p>
      <div className="row">
        <ActionForm action={publishJobAction}><input type="hidden" name="jobId" value={job.id} /><Submit>Publish job</Submit></ActionForm>
        <ActionForm action={cancelJobAction} confirm="Discard this draft?"><input type="hidden" name="jobId" value={job.id} /><Submit className="btn btn-ghost">Discard</Submit></ActionForm>
      </div>
    </div>
  );
}
