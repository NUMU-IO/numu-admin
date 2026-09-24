/**
 * Apps & Partners → Partner notices.
 *
 * Post a changelog entry or an API deprecation notice to every approved
 * partner. It lands in each partner's notification bell in the partner
 * portal; partners who join later do not receive older notices.
 */

import DashboardLayout from "@/components/DashboardLayout";
import { Badge, Button, Card, EmptyState, FormField, Input, Select, Skeleton, Textarea } from "@/ds";
import { formatDateTime } from "@/lib/format";
import { listNotices, postNotice, type NoticeKind } from "@/services/partnersApi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

const KIND_LABEL: Record<NoticeKind, string> = {
  changelog: "Changelog",
  deprecation: "API deprecation",
};

export default function PartnerNotices() {
  const queryClient = useQueryClient();
  const notices = useQuery({ queryKey: ["partner-notices"], queryFn: listNotices });
  const [kind, setKind] = useState<NoticeKind>("changelog");
  const [titleAr, setTitleAr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [bodyAr, setBodyAr] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [link, setLink] = useState("");

  const post = useMutation({
    mutationFn: () =>
      postNotice({
        notice_kind: kind,
        title_ar: titleAr.trim(),
        title_en: titleEn.trim(),
        body_ar: bodyAr.trim(),
        body_en: bodyEn.trim(),
        link: link.trim() || undefined,
      }),
    onSuccess: (r) => {
      toast.success(`Posted to ${r.recipients} partners`);
      setTitleAr("");
      setTitleEn("");
      setBodyAr("");
      setBodyEn("");
      setLink("");
      void queryClient.invalidateQueries({ queryKey: ["partner-notices"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  const ready = [titleAr, titleEn, bodyAr, bodyEn].every((v) => v.trim().length > 0);
  const rows = notices.data ?? [];

  return (
    <DashboardLayout title="Partner notices" subtitle="Changelog and API deprecation notices for every approved partner.">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Post a notice"
          footer={
            <Button variant="primary" icon="megaphone" disabled={!ready || post.isPending} loading={post.isPending} onClick={() => post.mutate()}>
              Post to all partners
            </Button>
          }
        >
          <div className="space-y-3">
            <FormField label="Type" htmlFor="notice-kind">
              <Select
                id="notice-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as NoticeKind)}
                options={[
                  { value: "changelog", label: KIND_LABEL.changelog },
                  { value: "deprecation", label: KIND_LABEL.deprecation },
                ]}
              />
            </FormField>
            <FormField label="Title (Arabic, Egyptian)" required htmlFor="notice-title-ar">
              <Input id="notice-title-ar" dir="rtl" maxLength={200} value={titleAr} onChange={(e) => setTitleAr(e.target.value)} />
            </FormField>
            <FormField label="Title (English)" required htmlFor="notice-title-en">
              <Input id="notice-title-en" maxLength={200} value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
            </FormField>
            <FormField label="Body (Arabic, Egyptian)" required htmlFor="notice-body-ar">
              <Textarea id="notice-body-ar" dir="rtl" rows={4} value={bodyAr} onChange={(e) => setBodyAr(e.target.value)} />
            </FormField>
            <FormField label="Body (English)" required htmlFor="notice-body-en">
              <Textarea id="notice-body-en" rows={4} value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} />
            </FormField>
            <FormField label="Link" htmlFor="notice-link" hint="Optional, e.g. the docs page for the change.">
              <Input id="notice-link" dir="ltr" mono placeholder="https://docs.numueg.app/…" value={link} onChange={(e) => setLink(e.target.value)} />
            </FormField>
          </div>
        </Card>

        <div className="space-y-3">
          {notices.isLoading ? <Skeleton height={120} variant="block" /> : null}
          {!notices.isLoading && rows.length === 0 ? (
            <Card>
              <EmptyState kind="empty" icon="inbox" title="No notices yet" body="Posted notices appear here." />
            </Card>
          ) : null}
          {rows.map((n) => (
            <Card
              key={n.notice_id}
              title={n.title.en}
              subtitle={`${formatDateTime(n.created_at)} · ${n.recipients} partners`}
              actions={<Badge tone={n.notice_kind === "deprecation" ? "warning" : "info"}>{KIND_LABEL[n.notice_kind]}</Badge>}
            >
              <p dir="rtl" lang="ar" className="font-semibold">
                {n.title.ar}
              </p>
              <p className="whitespace-pre-line text-sm">{n.body.en}</p>
              {n.link ? (
                <a className="text-sm underline underline-offset-2" href={n.link} target="_blank" rel="noopener noreferrer">
                  {n.link}
                </a>
              ) : null}
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
