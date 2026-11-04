import { IsDateString, validate } from "class-validator";
import { MIN_AGE_YEARS, MinAge } from "./min-age.validator";

class Probe {
  @IsDateString()
  @MinAge(MIN_AGE_YEARS)
  dateOfBirth: string;
}

const messagesFor = async (dateOfBirth: string) => {
  const errors = await validate(Object.assign(new Probe(), { dateOfBirth }));

  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
};

const birthDate = (yearsAgo: number, shiftDays: number) => {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - yearsAgo);
  date.setUTCDate(date.getUTCDate() + shiftDays);

  return date.toISOString();
};

describe("MinAge", () => {
  it("принимает день рождения ровно в 14 лет", async () => {
    expect(await messagesFor(birthDate(MIN_AGE_YEARS, 0))).toEqual([]);
  });

  it("принимает день рождения старше 14 лет", async () => {
    expect(await messagesFor(birthDate(MIN_AGE_YEARS + 20, 0))).toEqual([]);
  });

  it("отклоняет день рождения на один день моложе 14 лет", async () => {
    expect(await messagesFor(birthDate(MIN_AGE_YEARS, 1))).toEqual([
      `You must be at least ${MIN_AGE_YEARS} years old`,
    ]);
  });

  it("отклоняет день рождения в 13 лет", async () => {
    expect(await messagesFor(birthDate(13, 0))).toEqual([
      `You must be at least ${MIN_AGE_YEARS} years old`,
    ]);
  });

  it("отклоняет будущую дату отдельным сообщением", async () => {
    expect(await messagesFor(birthDate(0, 1))).toEqual([
      "Date of birth cannot be in the future",
    ]);
  });

  it("не добавляет своё сообщение к строке, которая не является датой", async () => {
    expect(await messagesFor("not-a-date")).toEqual([
      "dateOfBirth must be a valid ISO 8601 date string",
    ]);
  });

  it("оставляет пустое значение существующей проверке даты", async () => {
    expect(await messagesFor("")).toEqual([
      "dateOfBirth must be a valid ISO 8601 date string",
    ]);
  });
});
