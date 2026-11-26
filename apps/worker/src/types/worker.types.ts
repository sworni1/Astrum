export type Letter = {
  subject: string;
  text: string;
  html: string;
};

export type LetterLocale = "en" | "ru";

export type LetterCopy = {
  subject: string;
  greeting: string;
  intro: string;
  action: string;
  hint: string;
};

export type Mailer = {
  kind: "smtp" | "outbox";
  send(to: string, letter: Letter): Promise<void>;
};
