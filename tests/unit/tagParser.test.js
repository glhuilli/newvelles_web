import { describe, it, expect } from 'vitest';
import { parseTags } from '../../src/utils/tagParser.js';

describe('parseTags', () => {
  it('extracts tags from bracket-delimited string', () => {
    expect(parseTags('[Tag A] [Tag B]')).toEqual(['Tag A', 'Tag B']);
  });

  it('handles single tag', () => {
    expect(parseTags('[Single Tag]')).toEqual(['Single Tag']);
  });

  it('handles three tags', () => {
    expect(parseTags('[Tag A] [Tag B] [Tag C]')).toEqual(['Tag A', 'Tag B', 'Tag C']);
  });

  it('returns empty array for empty string', () => {
    expect(parseTags('')).toEqual([]);
  });

  it('handles extra whitespace', () => {
    expect(parseTags('  [Tag A]   [Tag B]  ')).toEqual(['Tag A', 'Tag B']);
  });

  it('handles whitespace inside brackets', () => {
    expect(parseTags('[  Tag A  ] [ Tag B ]')).toEqual(['Tag A', 'Tag B']);
  });

  it('returns empty array for null input', () => {
    expect(parseTags(null)).toEqual([]);
  });

  it('returns empty array for undefined input', () => {
    expect(parseTags(undefined)).toEqual([]);
  });

  it('handles multi-word tags', () => {
    expect(parseTags('[Trump Iran war] [Oil Prices Surge]')).toEqual(['Trump Iran war', 'Oil Prices Surge']);
  });
});
