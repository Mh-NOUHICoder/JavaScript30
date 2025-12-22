const inventors = [
  { first: 'Albert', last: 'Einstein', year: 1879, passed: 1955 },
  { first: 'Isaac', last: 'Newton', year: 1643, passed: 1727 },
  { first: 'Galileo', last: 'Galilei', year: 1564, passed: 1642 },
  { first: 'Marie', last: 'Curie', year: 1867, passed: 1934 },
  { first: 'Johannes', last: 'Kepler', year: 1571, passed: 1630 },
];

// 1. Filter inventors born in the 1500s
const fifteen = inventors.filter(inv => inv.year >= 1500 && inv.year < 1600);
console.table(fifteen);

// 2. Map inventor full names
const fullNames = inventors.map(inv => `${inv.first} ${inv.last}`);
console.log(fullNames);

// 3. Sort inventors by birthdate
const ordered = inventors.sort((a, b) => a.year > b.year ? 1 : -1);
console.table(ordered);

// 4. Reduce total years lived
const totalYears = inventors.reduce((sum, inv) => sum + (inv.passed - inv.year), 0);
