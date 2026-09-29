import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryDto, CreateCategoryDto, UpdateCategoryDto } from './category.dto';

interface UserContext {
  id: string;
  role: string;
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateCategoryDto): Promise<CategoryDto> {
    await this.assertNameIsAvailable(ownerId, dto.name);

    const created = await this.prisma.category.create({
      data: {
        name: dto.name.trim(),
        color: dto.color || '#3B82F6',
        ownerId,
      },
    });

    return this.serializeCategory(created);
  }

  async findAll(user: UserContext): Promise<CategoryDto[]> {
    const categories = await this.prisma.category.findMany({
      where: {
        ownerId: user.id,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { tasks: { where: { deletedAt: null } } },
        },
      },
    });

    return categories.map((category) => this.serializeCategory(category));
  }

  async update(user: UserContext, id: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    const existing = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Categoria não encontrada.');
    }

    if (existing.ownerId !== user.id) {
      throw new ForbiddenException('Você não tem permissão para modificar esta categoria.');
    }

    if (dto.name !== undefined && dto.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      await this.assertNameIsAvailable(existing.ownerId, dto.name);
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
      },
    });

    return this.serializeCategory(updated);
  }

  async remove(user: UserContext, id: string): Promise<void> {
    const existing = await this.prisma.category.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Categoria não encontrada.');
    }

    if (existing.ownerId !== user.id) {
      throw new ForbiddenException('Você não tem permissão para excluir esta categoria.');
    }

    // Remoção lógica com desvinculação das tarefas associadas
    await this.prisma.$transaction([
      this.prisma.task.updateMany({
        where: { categoryId: id },
        data: { categoryId: null },
      }),
      this.prisma.category.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
    ]);
  }

  private async assertNameIsAvailable(ownerId: string, name: string): Promise<void> {
    const existing = await this.prisma.category.findFirst({
      where: {
        ownerId,
        deletedAt: null,
        name: { equals: name.trim(), mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException('Você já possui uma categoria com este nome.');
    }
  }

  private serializeCategory(category: any): CategoryDto {
    return {
      id: category.id,
      name: category.name,
      color: category.color,
      taskCount: category._count?.tasks,
      createdAt: new Date(category.createdAt).toISOString(),
      updatedAt: new Date(category.updatedAt).toISOString(),
    };
  }
}