import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsHexColor,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Nome da categoria', example: 'Trabalho', minLength: 1, maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MinLength(1, { message: 'O nome deve ter no mínimo 1 caractere.' })
  @MaxLength(50, { message: 'O nome deve ter no máximo 50 caracteres.' })
  name!: string;

  @ApiPropertyOptional({ description: 'Cor em hexadecimal', example: '#3B82F6', default: '#3B82F6' })
  @IsOptional()
  @IsHexColor({ message: 'A cor deve ser um valor hexadecimal válido (ex.: #3B82F6).' })
  color?: string;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional({ description: 'Nome da categoria', minLength: 1, maxLength: 50 })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'O nome deve ter no mínimo 1 caractere.' })
  @MaxLength(50, { message: 'O nome deve ter no máximo 50 caracteres.' })
  name?: string;

  @ApiPropertyOptional({ description: 'Cor em hexadecimal', example: '#3B82F6' })
  @IsOptional()
  @IsHexColor({ message: 'A cor deve ser um valor hexadecimal válido (ex.: #3B82F6).' })
  color?: string;
}

export class CategoryDto {
  @ApiProperty({ description: 'Identificador único da categoria', example: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33' })
  id!: string;

  @ApiProperty({ description: 'Nome da categoria', example: 'Trabalho' })
  name!: string;

  @ApiProperty({ description: 'Cor em hexadecimal', example: '#3B82F6' })
  color!: string;

  @ApiPropertyOptional({ description: 'Quantidade de tarefas ativas associadas', example: 4 })
  taskCount?: number;

  @ApiProperty({ description: 'Data de criação' })
  createdAt!: string;

  @ApiProperty({ description: 'Data de última atualização' })
  updatedAt!: string;
}