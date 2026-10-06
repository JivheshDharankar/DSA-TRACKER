import { describe, it, expect } from 'vitest';
import { getSafeUrl } from '../../src/utils/url.util';

describe('Frontend URL Sanitization (getSafeUrl)', () => {
  it('allows valid HTTPS URLs', () => {
    expect(getSafeUrl('https://example.com')).toBe('https://example.com');
    expect(getSafeUrl('https://leetcode.com/problems/two-sum/')).toBe('https://leetcode.com/problems/two-sum/');
  });

  it('allows valid HTTP URLs', () => {
    expect(getSafeUrl('http://example.com')).toBe('http://example.com');
    expect(getSafeUrl('http://college.edu/dsa/1')).toBe('http://college.edu/dsa/1');
  });

  it('rejects javascript: URLs', () => {
    expect(getSafeUrl('javascript:alert(1)')).toBeUndefined();
    expect(getSafeUrl('JAVASCRIPT:alert(document.cookie)')).toBeUndefined();
    expect(getSafeUrl('javascript:void(0)')).toBeUndefined();
  });

  it('rejects data: URLs', () => {
    expect(getSafeUrl('data:text/html,<script>alert(1)</script>')).toBeUndefined();
    expect(getSafeUrl('DATA:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBeUndefined();
  });

  it('rejects vbscript: URLs', () => {
    expect(getSafeUrl('vbscript:msgbox(1)')).toBeUndefined();
  });

  it('rejects file: URLs', () => {
    expect(getSafeUrl('file:///etc/passwd')).toBeUndefined();
  });

  it('rejects ftp: URLs', () => {
    expect(getSafeUrl('ftp://example.com')).toBeUndefined();
  });

  it('rejects protocol-relative URLs (//example.com)', () => {
    expect(getSafeUrl('//example.com')).toBeUndefined();
  });

  it('rejects malformed or empty URLs', () => {
    expect(getSafeUrl('not a url')).toBeUndefined();
    expect(getSafeUrl('')).toBeUndefined();
    expect(getSafeUrl('   ')).toBeUndefined();
    expect(getSafeUrl(null)).toBeUndefined();
    expect(getSafeUrl(undefined)).toBeUndefined();
  });
});
