import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listOwners, createOwner, updateOwner, deleteOwner } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Pencil, Trash2, Check, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/settings/accounts")({
  component: AccountsPage,
});

function AccountsPage() {
  const qc = useQueryClient();
  const fetchOwners = useServerFn(listOwners);
  const create = useServerFn(createOwner);
  const update = useServerFn(updateOwner);
  const remove = useServerFn(deleteOwner);

  const { data: owners } = useQuery({ queryKey: ["owners"], queryFn: () => fetchOwners() });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["owners"] });

  const createMut = useMutation({
    mutationFn: async () => create({ data: { name, email } }),
    onSuccess: () => {
      toast.success("소유주 등록 완료. 소유주가 첫 로그인 시 입력한 비밀번호로 계정이 생성됩니다.");
      setName(""); setEmail(""); invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async () => update({ data: { id: editId!, name: editName, email: editEmail } }),
    onSuccess: () => { toast.success("수정 완료"); setEditId(null); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("삭제 완료"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>소유주 추가</CardTitle></CardHeader>
        <CardContent className="space-y-3 max-w-xl">
          <div className="space-y-2">
            <Label>소유주명 (엑셀 파일명과 일치)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 홍길동" />
          </div>
          <div className="space-y-2">
            <Label>로그인 이메일</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@example.com" />
            <p className="text-xs text-muted-foreground">비밀번호는 소유주가 첫 로그인 시 직접 설정합니다.</p>
          </div>
          <Button onClick={() => createMut.mutate()} disabled={!name || !email || createMut.isPending}>
            {createMut.isPending ? "등록 중..." : "소유주 등록"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>등록된 소유주</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="text-left py-2">소유주명</th>
                <th className="text-left">로그인 이메일</th>
                <th className="text-left">비밀번호</th>
                <th className="text-right">작업</th>
              </tr>
            </thead>
            <tbody>
              {(owners ?? []).map((o: any) => {
                const editing = editId === o.id;
                return (
                  <tr key={o.id} className="border-t">
                    <td className="py-2">
                      {editing
                        ? <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" />
                        : o.name}
                    </td>
                    <td className="font-mono text-xs">
                      {editing
                        ? <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="h-8" />
                        : (o.email ?? "—")}
                    </td>
                    <td>{o.password_set ? "✓" : "대기"}</td>
                    <td className="text-right space-x-1">
                      {editing ? (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditId(null)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => {
                            setEditId(o.id); setEditName(o.name); setEditEmail(o.email ?? "");
                          }}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => {
                            if (confirm(`${o.name} 소유주를 삭제할까요? 연결된 로그인 계정도 함께 삭제됩니다.`)) {
                              deleteMut.mutate(o.id);
                            }
                          }}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(!owners || owners.length === 0) && (
                <tr><td colSpan={4} className="py-3 text-muted-foreground">등록된 소유주가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
