import { expect, test } from 'vitest';
import { extractDateNumsFromStr, extractPages, extractVolume } from 'src/services/utils';

test('extract date from string', () => {
  expect(extractDateNumsFromStr('xx 2014-07-02 00:00:00')).toEqual({ year: '2014', month: '07', day: '02' });
  expect(extractDateNumsFromStr('Volume 173, 20 February 2024, Pages 192-201')).toEqual({
    year: '2024',
    month: '02',
    day: '20',
  });
  expect(extractDateNumsFromStr('xx July 2014')).toEqual({ year: '2014', month: '07', day: '01' });
});

test('extract volume from string', () => {
  expect(extractVolume('Volume 219, Part A, January 2024, 112744')).toBe('219');
});

test('extract pages from string', () => {
  expect(extractPages('Volume 173, 20 February 2024, Pages 192-201')).toBe('192-201');
});
