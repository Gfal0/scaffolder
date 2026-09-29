import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prisma: any;

  const mockUser = {
    id: 'user-uuid-1',
    role: 'USER',
  };

  const mockOtherUser = {
    id: 'user-uuid-2',
    role: 'USER',
  };

  const mockCategory = {
    id: 'category-uuid-1',
    name: 'Trabalho',
    color: '#3B82F6',
    ownerId: 'user-uuid-1',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = {
      category: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      task: {
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(async (operations: unknown[]) => operations),
    };
    service = new CategoriesService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('creates category for authenticated user', async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      prisma.category.create.mockResolvedValue(mockCategory);

      const result = await service.create(mockUser.id, { name: 'Trabalho' });

      expect(result.id).toBe(mockCategory.id);
      expect(prisma.category.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Trabalho', ownerId: mockUser.id }),
        }),
      );
    });

    it('rejects duplicate name (case-insensitive) for the same owner', async () => {
      prisma.category.findFirst.mockResolvedValue(mockCategory);

      await expect(
        service.create(mockUser.id, { name: 'trabalho' }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.category.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns only active categories owned by the user, with task count', async () => {
      prisma.category.findMany.mockResolvedValue([
        { ...mockCategory, _count: { tasks: 3 } },
      ]);

      const result = await service.findAll(mockUser);

      expect(result).toHaveLength(1);
      expect(result[0].taskCount).toBe(3);
      expect(prisma.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ ownerId: mockUser.id, deletedAt: null }),
        }),
      );
    });
  });

  describe('update', () => {
    it('updates category when owner matches', async () => {
      prisma.category.findFirst
        .mockResolvedValueOnce(mockCategory) // busca por existing
        .mockResolvedValueOnce(null); // busca de duplicidade de nome
      prisma.category.update.mockResolvedValue({ ...mockCategory, name: 'Pessoal' });

      const result = await service.update(mockUser, mockCategory.id, { name: 'Pessoal' });

      expect(result.name).toBe('Pessoal');
    });

    it('throws NotFoundException when category does not exist or is deleted', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(
        service.update(mockUser, 'non-existent', { name: 'Pessoal' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when another user tries to update the category', async () => {
      prisma.category.findFirst.mockResolvedValue(mockCategory);

      await expect(
        service.update(mockOtherUser, mockCategory.id, { name: 'Pessoal' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects renaming to a name already used by another active category', async () => {
      prisma.category.findFirst
        .mockResolvedValueOnce(mockCategory) // existing
        .mockResolvedValueOnce({ ...mockCategory, id: 'category-uuid-2' }); // duplicidade

      await expect(
        service.update(mockUser, mockCategory.id, { name: 'Pessoal' }),
      ).rejects.toThrow(ConflictException);
    });

    it('allows keeping the same name without triggering duplicate check', async () => {
      prisma.category.findFirst.mockResolvedValueOnce(mockCategory);
      prisma.category.update.mockResolvedValue({ ...mockCategory, color: '#FF0000' });

      await service.update(mockUser, mockCategory.id, { name: 'Trabalho', color: '#FF0000' });

      expect(prisma.category.findFirst).toHaveBeenCalledTimes(1);
    });
  });

  describe('remove (Soft Delete)', () => {
    it('soft deletes the category and unlinks tasks in a transaction', async () => {
      prisma.category.findFirst.mockResolvedValue(mockCategory);

      await service.remove(mockUser, mockCategory.id);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.task.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { categoryId: mockCategory.id },
          data: { categoryId: null },
        }),
      );
      expect(prisma.category.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockCategory.id },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });

    it('throws NotFoundException when category does not exist or is deleted', async () => {
      prisma.category.findFirst.mockResolvedValue(null);

      await expect(service.remove(mockUser, 'non-existent')).rejects.toThrow(NotFoundException);
    });

    it('prevents non-owner from deleting the category', async () => {
      prisma.category.findFirst.mockResolvedValue(mockCategory);

      await expect(service.remove(mockOtherUser, mockCategory.id)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});