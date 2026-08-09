export const TEST_USER = {
  get email() {
    return process.env.LOADTEST_EMAIL ?? '';
  },
  get otp() {
    return process.env.LOADTEST_OTP ?? '';
  }
};
