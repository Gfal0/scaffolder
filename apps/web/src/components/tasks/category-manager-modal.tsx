import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Plus, Trash2, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ActionFeedback, EmptyState, LoadingState } from '../ui/state-feedback';
import {
  categoriesControllerCreate,
  categoriesControllerFindAll,
  categoriesControllerRemove,
  categoriesControllerUpdate,
} from '../../lib/api-client';
import type { CategoryDto } from '../../lib/api-client/models';

const categoryFormSchema = z.object({
  name: z.string().min(1, 'Informe um nome.').max(50, 'Máximo de 50 caracteres.'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida.'),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export function CategoryManagerModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [editingCategory, setEditingCategory] = useState<CategoryDto | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await categoriesControllerFindAll();
      return res.data as CategoryDto[];
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name: '', color: '#3B82F6' },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CategoryFormValues) => {
      const res = await categoriesControllerCreate(data);
      return res.data;
    },
    onSuccess: () => {
      setFeedback({ type: 'success', message: 'Categoria criada com sucesso!' });
      reset({ name: '', color: '#3B82F6' });
      invalidateAll();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { detail?: string })?.detail ||
        (err as { message?: string })?.message ||
        'Não foi possível criar a categoria.';
      setFeedback({ type: 'error', message: msg });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CategoryFormValues }) => {
      const res = await categoriesControllerUpdate(id, data);
      return res.data;
    },
    onSuccess: () => {
      setFeedback({ type: 'success', message: 'Categoria atualizada com sucesso!' });
      setEditingCategory(null);
      invalidateAll();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { detail?: string })?.detail ||
        (err as { message?: string })?.message ||
        'Falha ao atualizar a categoria.';
      setFeedback({ type: 'error', message: msg });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await categoriesControllerRemove(id);
    },
    onSuccess: () => {
      setFeedback({ type: 'success', message: 'Categoria removida com sucesso.' });
      invalidateAll();
    },
    onError: (err: unknown) => {
      const msg =
        (err as { detail?: string })?.detail ||
        (err as { message?: string })?.message ||
        'Falha ao excluir a categoria.';
      setFeedback({ type: 'error', message: msg });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-md w-full p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
          Gerenciar Categorias
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Crie, edite ou remova categorias para organizar suas tarefas.
        </p>

        {feedback && (
          <div className="mb-4">
            <ActionFeedback
              type={feedback.type}
              message={feedback.message}
              onClose={() => setFeedback(null)}
            />
          </div>
        )}

        <form
          onSubmit={handleSubmit((data) => {
            setFeedback(null);
            if (editingCategory) {
              updateMutation.mutate({ id: editingCategory.id, data });
            } else {
              createMutation.mutate(data);
            }
          })}
          className="flex items-end gap-2 mb-5"
        >
          <div className="flex-1">
            <Input
              label="Nome"
              placeholder="Ex.: Trabalho"
              {...register('name')}
              error={errors.name?.message}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cor</label>
            <input
              type="color"
              {...register('color')}
              className="h-10 w-12 rounded-md border border-slate-300 dark:border-slate-700 bg-transparent p-1"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            className="h-10 gap-1"
            isLoading={createMutation.isPending || updateMutation.isPending}
          >
            {editingCategory ? 'Salvar' : <Plus className="h-4 w-4" />}
          </Button>
          {editingCategory && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10"
              onClick={() => {
                setEditingCategory(null);
                reset({ name: '', color: '#3B82F6' });
              }}
            >
              Cancelar
            </Button>
          )}
        </form>

        {isLoading ? (
          <LoadingState message="Carregando categorias..." />
        ) : !categories || categories.length === 0 ? (
          <EmptyState title="Nenhuma categoria criada" description="Crie a primeira categoria acima." />
        ) : (
          <ul className="space-y-2">
            {categories.map((category) => (
              <li
                key={category.id}
                className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-3.5 w-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {category.name}
                  </span>
                  <span className="text-xs text-slate-400 shrink-0">
                    {category.taskCount ?? 0} tarefa(s)
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    title="Editar Categoria"
                    onClick={() => {
                      setEditingCategory(category);
                      reset({ name: category.name, color: category.color });
                    }}
                  >
                    <Edit2 className="h-3.5 w-3.5 text-slate-500" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                    title="Excluir Categoria"
                    isLoading={deleteMutation.isPending && deleteMutation.variables === category.id}
                    onClick={() => {
                      if (confirm(`Remover a categoria "${category.name}"? As tarefas ficarão sem categoria.`)) {
                        deleteMutation.mutate(category.id);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}