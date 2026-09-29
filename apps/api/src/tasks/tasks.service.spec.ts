import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { TaskPriorityEnum, TaskStatusEnum } from './task.dto';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;
  let prisma: any;

  const mockUser = {
    id: 'user-uuid-1',
    role: 'USER',
  };

  const mockOtherUser = {
    id: 'user-uuid-2',
    role: 'USER',
  };

  const mockAdmin = {
    id: 'admin-uuid-1',
    role: 'ADMIN',
  };

  const mockCategory = {
    id: 'category-uuid-1',
    name: 'Trabalho',
    color: '#3B82F6',
    ownerId: 'user-uuid-1',
    deletedAt: null,
  };

  const mockTask = {
    id: 'task-uuid-1',
    title: 'Estudar Arquitetura BFF',
    description: 'Aprender sobre sessões opacas e Keycloak',
    status: TaskStatusEnum.PENDING,
    priority: TaskPriorityEnum.HIGH,
    dueDate: new Date(Date.now() + 86400000),
    ownerId: 'user-uuid-1',
    categoryId: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    owner: {
      id: 'user-uuid-1',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
    },
    category: null,
  };

  beforeEach(() => {
    prisma = {
      task: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      category: {
        findFirst: vi.fn(),
      },
    };
    service = new TasksService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('creates task for authenticated user', async () => {
      prisma.task.create.mockResolvedValue(mockTask);

      const result = await service.create(mockUser.id, {
        title: 'Estudar Arquitetura BFF',
        description: 'Aprender sobre sessões opacas e Keycloak',
        priority: TaskPriorityEnum.HIGH,
        dueDate: mockTask.dueDate.toISOString(),
      });

      expect(result.id).toBe(mockTask.id);
      expect(result.ownerId).toBe(mockUser.id);
      expect(prisma.task.create).toHaveBeenCalled();
    });

    it('rejects due date set in the past', async () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString();

      await expect(
        service.create(mockUser.id, {
          title: 'Tarefa no passado',
          dueDate: pastDate,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('assigns categoryId when the category belongs to the owner', async () => {
      prisma.category.findFirst.mockResolvedValue(mockCategory);
      prisma.task.create.mockResolvedValue({
        ...mockTask,
        categoryId: mockCategory.id,
        category: mockCategory,
      });

      const result = await service.create(mockUser.id, {
        title: 'Tarefa com categoria',
        categoryId: mockCategory.id,
      });

      expect(prisma.category.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: mockCategory.id, ownerId: mockUser.id }),
        }),
      );
      expect(result.category?.id).toBe(mockCategory.id);
    });

    it('rejects categoryId that does not belong to the owner', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(
        service.create(mockUser.id, {
          title: 'Tarefa com categoria inválida',
          categoryId: 'category-de-outro-usuario',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('restricts query to own tasks for regular users', async () => {
      prisma.task.count.mockResolvedValue(1);
      prisma.task.findMany.mockResolvedValue([mockTask]);

      const result = await service.findAll(mockUser, { page: 1, pageSize: 10 });

      expect(result.data).toHaveLength(1);
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            ownerId: mockUser.id,
          }),
        }),
      );
    });

    it('allows admin to query tasks from all users', async () => {
      prisma.task.count.mockResolvedValue(1);
      prisma.task.findMany.mockResolvedValue([mockTask]);

      const result = await service.findAll(mockAdmin, { page: 1, pageSize: 10 });

      expect(result.data).toHaveLength(1);
      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        }),
      );
      expect(prisma.task.findMany.mock.calls[0][0].where.ownerId).toBeUndefined();
    });

    it('filters by categoryId when provided', async () => {
      prisma.task.count.mockResolvedValue(1);
      prisma.task.findMany.mockResolvedValue([mockTask]);

      await service.findAll(mockUser, { page: 1, pageSize: 10, categoryId: mockCategory.id });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ categoryId: mockCategory.id }),
        }),
      );
    });
  });

  describe('findById and Ownership', () => {
    it('returns task when user is the owner', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);

      const result = await service.findById(mockUser, mockTask.id);
      expect(result.id).toBe(mockTask.id);
    });

    it('allows admin to view task owned by another user', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);

      const result = await service.findById(mockAdmin, mockTask.id);
      expect(result.id).toBe(mockTask.id);
    });

    it('throws ForbiddenException when another regular user tries to access task', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);

      await expect(service.findById(mockOtherUser, mockTask.id)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when task does not exist or is deleted', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(service.findById(mockUser, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update and Business Rules', () => {
    it('updates task when valid', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);
      prisma.task.update.mockResolvedValue({
        ...mockTask,
        title: 'Título Atualizado',
      });

      const result = await service.update(mockUser, mockTask.id, {
        title: 'Título Atualizado',
      });

      expect(result.title).toBe('Título Atualizado');
    });

    it('rejects editing field details of a COMPLETED task without reopening it first', async () => {
      const completedTask = {
        ...mockTask,
        status: TaskStatusEnum.COMPLETED,
      };
      prisma.task.findFirst.mockResolvedValue(completedTask);

      await expect(
        service.update(mockUser, mockTask.id, {
          title: 'Novo Título Proibido',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows editing if status is reopened to PENDING', async () => {
      const completedTask = {
        ...mockTask,
        status: TaskStatusEnum.COMPLETED,
      };
      prisma.task.findFirst.mockResolvedValue(completedTask);
      prisma.task.update.mockResolvedValue({
        ...mockTask,
        status: TaskStatusEnum.PENDING,
        title: 'Título Reaberto',
      });

      const result = await service.update(mockUser, mockTask.id, {
        status: TaskStatusEnum.PENDING,
        title: 'Título Reaberto',
      });

      expect(result.status).toBe(TaskStatusEnum.PENDING);
    });

    it('rejects changing categoryId of a COMPLETED task without reopening it first', async () => {
      const completedTask = {
        ...mockTask,
        status: TaskStatusEnum.COMPLETED,
      };
      prisma.task.findFirst.mockResolvedValue(completedTask);

      await expect(
        service.update(mockUser, mockTask.id, {
          categoryId: mockCategory.id,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects categoryId that does not belong to the task owner', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(
        service.update(mockUser, mockTask.id, {
          categoryId: 'category-de-outro-usuario',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows removing the category by sending categoryId as null', async () => {
      const taskWithCategory = { ...mockTask, categoryId: mockCategory.id, category: mockCategory };
      prisma.task.findFirst.mockResolvedValue(taskWithCategory);
      prisma.task.update.mockResolvedValue({
        ...taskWithCategory,
        categoryId: null,
        category: null,
      });

      const result = await service.update(mockUser, mockTask.id, {
        categoryId: null,
      });

      expect(result.categoryId).toBeNull();
      expect(prisma.category.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('remove (Soft Delete)', () => {
    it('sets deletedAt on remove', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);
      prisma.task.update.mockResolvedValue({
        ...mockTask,
        deletedAt: new Date(),
      });

      await service.remove(mockUser, mockTask.id);

      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockTask.id },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('prevents non-owner regular user from deleting task', async () => {
      prisma.task.findFirst.mockResolvedValue(mockTask);

      await expect(service.remove(mockOtherUser, mockTask.id)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});