-- Migration: 20260901_task_categories
-- Description: Categorias de tarefas com ownership, nome único por usuário e remoção lógica

-- Consulta 001: Criação da tabela categories
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "ownerId" UUID NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- Consulta 002: Criação de índices para consultas rápidas por dono e soft delete
CREATE INDEX "categories_ownerId_idx" ON "categories"("ownerId");
CREATE INDEX "categories_deletedAt_idx" ON "categories"("deletedAt");

-- Consulta 003: Nome de categoria único por usuário entre categorias ativas (case-insensitive)
CREATE UNIQUE INDEX "categories_ownerId_lower_name_active_key"
    ON "categories"("ownerId", LOWER("name"))
    WHERE "deletedAt" IS NULL;

-- Consulta 004: Foreign key relacionando ao perfil do usuário
ALTER TABLE "categories" ADD CONSTRAINT "categories_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Consulta 005: Coluna opcional categoryId em tasks
ALTER TABLE "tasks" ADD COLUMN "categoryId" UUID;
CREATE INDEX "tasks_categoryId_idx" ON "tasks"("categoryId");

-- Consulta 006: Foreign key Task -> Category (ao remover a categoria, a tarefa fica sem categoria)
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;