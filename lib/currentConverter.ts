export enum CURRENCY_TYPES {
  "USD" = "USD",
  "INR" = "INR",
}

type currencyCodeArgs = {
  currencyCode?: CURRENCY_TYPES;
  amount: number;
};

const USD_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: CURRENCY_TYPES.USD,
});

const INR_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: CURRENCY_TYPES.INR,
});

export const currencyConverter = (args: currencyCodeArgs) => {
  const { currencyCode = CURRENCY_TYPES.USD, amount } = args;

  if (currencyCode === CURRENCY_TYPES.USD) {
    return USD_FORMATTER.format(amount);
  }
  if (currencyCode === CURRENCY_TYPES.INR) {
    return INR_FORMATTER.format(amount);
  }

  return USD_FORMATTER.format(amount);
};
