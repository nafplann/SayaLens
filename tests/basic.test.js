// Basic test to verify Jest is working
describe('Basic Tests', () => {
  test('Jest is working correctly', () => {
    expect(1 + 1).toBe(2);
  });

  test('String operations', () => {
    expect('hello'.toUpperCase()).toBe('HELLO');
  });

  test('Array operations', () => {
    const arr = [1, 2, 3];
    expect(arr).toHaveLength(3);
    expect(arr.includes(2)).toBe(true);
  });

  test('Object operations', () => {
    const obj = { name: 'test', value: 42 };
    expect(obj.name).toBe('test');
    expect(obj.value).toBe(42);
  });

  test('Async operations', async () => {
    const promise = Promise.resolve('success');
    const result = await promise;
    expect(result).toBe('success');
  });
});
