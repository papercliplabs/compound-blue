import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./src/app/**/*.{js,ts,jsx,tsx,mdx}", "./src/components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      screens: {
        lg: "1080px",
      },
      fontFamily: {
        inter: ["var(--font-inter)"],
      },
      boxShadow: {
        card: "0px 2px 8px 0px #00000066",
      },
      colors: {
        background: {
          primary: "rgb(var(--background-primary))",
          secondary: "rgb(var(--background-secondary))",
          inverse: "rgb(var(--background-inverse))",
        },
        border: {
          primary: "rgb(var(--border-primary))",
        },
        content: {
          primary: "rgb(var(--content-primary))",
          secondary: "rgb(var(--content-secondary))",
          ternary: "rgb(var(--content-ternary))",
          disabled: "rgb(var(--content-disabled))",
        },
        semantic: {
          warning: "rgb(var(--semantic-warning))",
          negative: "rgb(var(--semantic-negative))",
          positive: "rgb(var(--semantic-positive))",
        },
        accent: {
          primary: "rgb(var(--accent-primary))",
          secondary: "rgb(var(--accent-secondary))",
          ternary: "rgb(var(--accent-ternary))",
        },
        button: {
          supply: {
            DEFAULT: "rgb(var(--button-supply))",
            muted: "rgb(var(--button-supply-muted))",
          },
          borrow: "rgb(var(--button-borrow))",
          neutral: "rgb(var(--button-neutral))",
          disabled: "rgb(var(--button-disabled))",
        },
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("tailwind-scrollbar"),
    function ({ addUtilities }: { addUtilities: any }) {
      addUtilities({
        ".title-1": {
          "@apply font-inter text-[40px] font-bold leading-[48px] tracking-[-0.03em]": {},
        },
        ".title-2": {
          "@apply font-inter text-[32px] font-bold leading-[36px] tracking-[-0.03em]": {},
        },
        ".title-3": {
          "@apply font-inter text-[24px] font-medium leading-[32px] tracking-[-0.03em]": {},
        },
        ".title-4": {
          "@apply font-inter text-[20px] font-medium leading-[24px] tracking-[-0.03em]": {},
        },
        ".title-5": {
          "@apply font-inter text-[18px] font-bold leading-[22px] tracking-[-0.03em]": {},
        },
        ".paragraph-lg": {
          "@apply font-inter text-[16px] leading-[24px] tracking-[-0.03em]": {},
        },
        ".paragraph-md": {
          "@apply font-inter text-[14px] leading-[20px] tracking-[-0.035em]": {},
        },
        ".paragraph-sm": {
          "@apply font-inter text-[12px] leading-[16px] tracking-[-0.03em]": {},
        },
        ".shadow-top-only": {
          "@apply shadow-[0px_-2px_6px_rgba(0,0,0,0.05),0px_4px_36px_rgba(0,0,0,0.04)]": {},
          "clip-path": "inset(-36px 0 0 0)",
        },
        ".shadow-bottom-only": {
          "@apply shadow-[0px_2px_6px_rgba(0,0,0,0.05),0px_-4px_36px_rgba(0,0,0,0.04)]": {},
          "clip-path": "inset(0 0 -36px 0)",
        },
      });
    },
  ],
} satisfies Config;
