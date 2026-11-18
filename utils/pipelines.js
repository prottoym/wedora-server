
export const lookupOne = (from, localField, as, fields) => [
  { $lookup: { from, localField, foreignField: "_id", as } },
  { $unwind: { path: `$${as}`, preserveNullAndEmptyArrays: true } },
  {
    $addFields: {
      [as]: Object.fromEntries(fields.map((f) => [f, `$${as}.${f}`])),
    },
  },
];