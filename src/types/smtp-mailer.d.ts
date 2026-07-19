declare module "smtp-mailer" {
  export * from "nodemailer";
  import nodemailer from "nodemailer";
  export default nodemailer;
}
