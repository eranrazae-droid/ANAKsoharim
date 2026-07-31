export const getMaxPaymentsByYear = (year: number) => {
  if (year >= 2023) return 100;
  if (year === 2022) return 84;
  if (year === 2021) return 72;
  if (year === 2020) return 60;
  if (year === 2019) return 58;
  if (year === 2018) return 46;
  if (year === 2017) return 34;
  if (year === 2016) return 22;
  if (year >= 2013) return 36;
  if (year === 2012) return 24;
  return 12;
};
