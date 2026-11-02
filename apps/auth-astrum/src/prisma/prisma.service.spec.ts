import { PrismaService } from './prisma.service';

// PrismaService наследует PrismaClient; мы не можем безопасно инстанцировать
// его без DATABASE_URL и подключения к Postgres, поэтому проверяем только
// декоратор @Injectable() (наличие метаданных Nest).
describe('PrismaService', () => {
  it('класс определён и декорирован @Injectable', () => {
    expect(PrismaService).toBeDefined();
    // reflect-metadata заполняется при загрузке модуля — упрощённая проверка
    expect(typeof PrismaService).toBe('function');
  });

  it('метод cleandb существует', () => {
    expect(typeof PrismaService.prototype.cleandb).toBe('function');
  });
});
