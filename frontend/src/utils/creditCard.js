// A card's bill is paid when it was marked paid for its current due date.
// A new statement moves billDueDate, which makes the card unpaid again.
const dayKey = (value) => {
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export const isCardPaid = (card) =>
  !!card?.paidDueDate && !!card?.billDueDate && dayKey(card.paidDueDate) === dayKey(card.billDueDate);
