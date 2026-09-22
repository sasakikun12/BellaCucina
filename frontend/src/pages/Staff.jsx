import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createUser, deleteUser, fetchUsers } from "../api/users";
import { Modal } from "../components/Modal";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABEL } from "../lib/status";

const ROLES = ["ADMIN", "WAITER", "KITCHEN", "DELIVERY"];

export function Staff() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useQuery({ queryKey: ["users"], queryFn: fetchUsers });
  const [showForm, setShowForm] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Equipe</h1>
          <p className="text-sm text-stone-500">Gerencie as contas e cargos da equipe.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          + Adicionar membro
        </button>
      </div>

      {isLoading && <p className="text-stone-500">Carregando equipe…</p>}

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {users?.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium text-stone-800">{u.name}</td>
                  <td className="px-4 py-3 text-stone-500">{u.email}</td>
                  <td className="px-4 py-3 text-stone-500">{ROLE_LABEL[u.role]}</td>
                  <td className="px-4 py-3 text-right">
                    {u.id !== me?.id && (
                      <button
                        onClick={() => {
                          if (confirm(`Remover ${u.name}?`)) deleteMutation.mutate(u.id);
                        }}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Remover
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <StaffForm onClose={() => setShowForm(false)} />}
    </div>
  );
}

function StaffForm({ onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "WAITER" });
  const [error, setError] = useState(null);

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (err) => {
      const message = err?.response?.data?.error;
      setError(message || "Não foi possível criar o usuário");
    },
  });

  return (
    <Modal title="Adicionar membro da equipe" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          mutation.mutate(form);
        }}
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1 text-sm font-medium text-stone-600">
          Nome
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-stone-600">
          E-mail
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-stone-600">
          Senha
          <input
            required
            minLength={6}
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-stone-600">
          Cargo
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            className="input"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? "Criando…" : "Criar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
