if (process.env.TEST_DATABASE_URL) {
  const name = new URL(process.env.TEST_DATABASE_URL).pathname.slice(1);
  if (!name.endsWith('_test'))
    throw new Error(
      'TEST_DATABASE_URL must point to a dedicated database whose name ends with _test. Integration tests modify records.',
    );
}
