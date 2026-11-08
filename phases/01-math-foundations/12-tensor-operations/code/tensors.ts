// Lesson: Tensor Operations (phase 01 / lesson 12)
// TypeScript port of code/tensors.py. Node standard library only.
// Source: phases/01-math-foundations/12-tensor-operations/docs/en.md
// Run: npx tsx phases/01-math-foundations/12-tensor-operations/code/tensors.ts
type Nested = number | Nested[];
type DType = "int64" | "float64" | "float32";
type Order = "C" | "F";

function allocate(dtype: DType, size: number): Float64Array | Float32Array {
  return dtype === "float32" ? new Float32Array(size) : new Float64Array(size);
}

function product(values: number[]): number {
  let result = 1;
  for (const value of values) {
    result *= value;
  }
  return result;
}

function pyShape(shape: number[]): string {
  if (shape.length === 0) {
    return "()";
  }
  if (shape.length === 1) {
    return `(${shape[0]},)`;
  }
  return `(${shape.join(", ")})`;
}

function pyFloat(value: number): string {
  if (Number.isInteger(value) && Math.abs(value) < 1e16) {
    return value.toFixed(1);
  }
  return String(value);
}

function pyBool(value: boolean): string {
  return value ? "True" : "False";
}

function formatNested(value: Nested, isFloat: boolean): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => formatNested(item, isFloat)).join(", ")}]`;
  }
  return isFloat ? pyFloat(value) : String(value);
}

function forEachIndex(shape: number[], visit: (index: number[]) => void): void {
  const total = product(shape);
  const index = new Array<number>(shape.length).fill(0);
  for (let count = 0; count < total; count++) {
    visit(index);
    for (let axis = shape.length - 1; axis >= 0; axis--) {
      index[axis]!++;
      if (index[axis]! < shape[axis]!) {
        break;
      }
      index[axis] = 0;
    }
  }
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let random = mulberry32(1);
let spareNormal: number | null = null;

function seed(value: number): void {
  random = mulberry32(value);
  spareNormal = null;
}

function standardNormal(): number {
  if (spareNormal !== null) {
    const value = spareNormal;
    spareNormal = null;
    return value;
  }
  let u = random();
  while (u === 0) {
    u = random();
  }
  const v = random();
  const radius = Math.sqrt(-2 * Math.log(u));
  spareNormal = radius * Math.sin(2 * Math.PI * v);
  return radius * Math.cos(2 * Math.PI * v);
}

function computeStrides(shape: number[]): number[] {
  const strides = new Array<number>(shape.length).fill(1);
  for (let i = shape.length - 2; i >= 0; i--) {
    strides[i] = strides[i + 1]! * shape[i + 1]!;
  }
  return strides;
}

class NDArray {
  data: Float64Array | Float32Array;
  shape: number[];
  strides: number[];
  offset: number;
  dtype: DType;

  constructor(
    data: Float64Array | Float32Array,
    shape: number[],
    dtype: DType,
    strides: number[] = computeStrides(shape),
    offset = 0,
  ) {
    this.data = data;
    this.shape = shape;
    this.dtype = dtype;
    this.strides = strides;
    this.offset = offset;
  }

  static fromValues(values: number[], shape: number[], dtype: DType = "float64", order: Order = "C"): NDArray {
    if (order === "C") {
      const data = allocate(dtype, values.length);
      data.set(values);
      return new NDArray(data, shape, dtype);
    }
    const reversed = [...shape].reverse();
    const fStrides = computeStrides(reversed).reverse();
    const data = allocate(dtype, values.length);
    let position = 0;
    forEachIndex(shape, (index) => {
      let flat = 0;
      for (let axis = 0; axis < index.length; axis++) {
        flat += index[axis]! * fStrides[axis]!;
      }
      data[flat] = values[position]!;
      position++;
    });
    return new NDArray(data, shape, dtype, fStrides);
  }

  static fromRows(rows: number[][], dtype: DType = "int64", order: Order = "C"): NDArray {
    return NDArray.fromValues(rows.flat(), [rows.length, rows[0]!.length], dtype, order);
  }

  static randn(shape: number[], dtype: DType = "float64"): NDArray {
    const size = product(shape);
    const data = allocate(dtype, size);
    for (let i = 0; i < size; i++) {
      data[i] = standardNormal();
    }
    return new NDArray(data, shape, dtype);
  }

  static full(shape: number[], value: number, dtype: DType = "float64"): NDArray {
    return new NDArray(allocate(dtype, product(shape)).fill(value), shape, dtype);
  }

  static arange(count: number): NDArray {
    const values: number[] = [];
    for (let i = 0; i < count; i++) {
      values.push(i);
    }
    return NDArray.fromValues(values, [count], "int64");
  }

  get itemsize(): number {
    return this.dtype === "float32" ? 4 : 8;
  }

  get size(): number {
    return product(this.shape);
  }

  get nbytes(): number {
    return this.size * this.itemsize;
  }

  get byteStrides(): number[] {
    return this.strides.map((stride) => stride * this.itemsize);
  }

  flatOffset(index: number[]): number {
    let flat = this.offset;
    for (let axis = 0; axis < index.length; axis++) {
      flat += index[axis]! * this.strides[axis]!;
    }
    return flat;
  }

  at(index: number[]): number {
    return this.data[this.flatOffset(index)]!;
  }

  set(index: number[], value: number): void {
    this.data[this.flatOffset(index)] = value;
  }

  toValues(): number[] {
    const values: number[] = [];
    forEachIndex(this.shape, (index) => values.push(this.at(index)));
    return values;
  }

  isCContiguous(): boolean {
    let expected = 1;
    for (let axis = this.shape.length - 1; axis >= 0; axis--) {
      if (this.shape[axis] !== 1) {
        if (this.strides[axis] !== expected) {
          return false;
        }
        expected *= this.shape[axis]!;
      }
    }
    return true;
  }

  isFContiguous(): boolean {
    let expected = 1;
    for (let axis = 0; axis < this.shape.length; axis++) {
      if (this.shape[axis] !== 1) {
        if (this.strides[axis] !== expected) {
          return false;
        }
        expected *= this.shape[axis]!;
      }
    }
    return true;
  }

  copyContiguous(): NDArray {
    const values = this.toValues();
    const data = this.dtype === "float32" ? Float32Array.from(values) : Float64Array.from(values);
    return new NDArray(data, [...this.shape], this.dtype);
  }

  reshape(newShape: number[]): NDArray {
    const shape = [...newShape];
    const unknown = shape.indexOf(-1);
    if (unknown !== -1) {
      const known = product(shape.filter((size) => size !== -1));
      shape[unknown] = this.size / known;
      if (!Number.isInteger(shape[unknown])) {
        throw new Error(`cannot reshape array of size ${this.size} into shape ${pyShape(newShape)}`);
      }
    }
    if (product(shape) !== this.size) {
      throw new Error(`cannot reshape array of size ${this.size} into shape ${pyShape(shape)}`);
    }
    const source = this.isCContiguous() ? this : this.copyContiguous();
    return new NDArray(source.data, shape, source.dtype, computeStrides(shape), source.offset);
  }

  transpose(axes?: number[]): NDArray {
    const order = axes ?? this.shape.map((_, i) => this.shape.length - 1 - i);
    return new NDArray(
      this.data,
      order.map((axis) => this.shape[axis]!),
      this.dtype,
      order.map((axis) => this.strides[axis]!),
      this.offset,
    );
  }

  get T(): NDArray {
    return this.transpose();
  }

  everyOther(axis: number, step: number): NDArray {
    const shape = [...this.shape];
    const strides = [...this.strides];
    shape[axis] = Math.ceil(shape[axis]! / step);
    strides[axis] = strides[axis]! * step;
    return new NDArray(this.data, shape, this.dtype, strides, this.offset);
  }

  ravel(order: "C" | "K" = "C"): NDArray {
    if (order === "C") {
      return NDArray.fromValues(this.toValues(), [this.size], this.dtype);
    }
    const axes = this.shape.map((_, i) => i);
    axes.sort((a, b) => this.strides[b]! - this.strides[a]!);
    return NDArray.fromValues(this.transpose(axes).toValues(), [this.size], this.dtype);
  }

  map(fn: (value: number) => number): NDArray {
    return NDArray.fromValues(this.toValues().map(fn), [...this.shape], this.dtype);
  }

  toString(): string {
    return formatNumpy(this);
  }
}

function formatNumpy(array: NDArray): string {
  const values = array.toValues();
  if (array.shape.length === 0) {
    return array.dtype === "int64" ? String(values[0]) : pyFloat(values[0]!);
  }
  const texts = values.map((value) => {
    if (array.dtype === "int64") {
      return String(value);
    }
    return Number.isInteger(value) ? `${value}.` : String(value);
  });
  const width = Math.max(...texts.map((text) => text.length));
  const padded = texts.map((text) => text.padStart(width));

  let position = 0;
  function build(axis: number): string {
    const count = array.shape[axis]!;
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      if (axis === array.shape.length - 1) {
        parts.push(padded[position]!);
        position++;
      } else {
        parts.push(build(axis + 1));
      }
    }
    if (axis === array.shape.length - 1) {
      return `[${parts.join(" ")}]`;
    }
    const blankLines = "\n".repeat(array.shape.length - axis - 1);
    return `[${parts.join(blankLines + " ".repeat(axis + 1))}]`;
  }
  return build(0);
}

function broadcastShapes(a: number[], b: number[]): number[] {
  const length = Math.max(a.length, b.length);
  const result: number[] = [];
  for (let i = 0; i < length; i++) {
    const sizeA = a[a.length - length + i] ?? 1;
    const sizeB = b[b.length - length + i] ?? 1;
    if (sizeA !== sizeB && sizeA !== 1 && sizeB !== 1) {
      throw new Error(
        `operands could not be broadcast together with shapes ${pyShape(a)} ${pyShape(b)}`,
      );
    }
    result.push(sizeA === 1 ? sizeB : sizeA);
  }
  return result;
}

function broadcastIndex(outIndex: number[], shape: number[]): number[] {
  const skip = outIndex.length - shape.length;
  return shape.map((size, axis) => (size === 1 ? 0 : outIndex[skip + axis]!));
}

function elementwise(a: NDArray, b: NDArray | number, op: (x: number, y: number) => number): NDArray {
  const other = typeof b === "number" ? NDArray.full([], b) : b;
  const shape = broadcastShapes(a.shape, other.shape);
  const values: number[] = [];
  forEachIndex(shape, (index) => {
    values.push(op(a.at(broadcastIndex(index, a.shape)), other.at(broadcastIndex(index, other.shape))));
  });
  const dtype = a.dtype === "int64" && other.dtype === "int64" ? "int64" : "float64";
  return NDArray.fromValues(values, shape, dtype);
}

function add(a: NDArray, b: NDArray | number): NDArray {
  return elementwise(a, b, (x, y) => x + y);
}

function sub(a: NDArray, b: NDArray | number): NDArray {
  return elementwise(a, b, (x, y) => x - y);
}

function mul(a: NDArray, b: NDArray | number): NDArray {
  return elementwise(a, b, (x, y) => x * y);
}

function div(a: NDArray, b: NDArray | number): NDArray {
  return elementwise(a, b, (x, y) => x / y);
}

type Reduction = "sum" | "mean" | "max" | "argmax";

function reduce(a: NDArray, kind: Reduction, axes?: number[], keepdims = false): NDArray {
  const reduced = (axes ?? a.shape.map((_, i) => i)).map((axis) => (axis < 0 ? a.shape.length + axis : axis));
  const keptShape = a.shape.map((size, axis) => (reduced.includes(axis) ? 1 : size));
  const groupSize = product(reduced.map((axis) => a.shape[axis]!));
  const groups: number[][] = [];
  for (let i = 0; i < product(keptShape); i++) {
    groups.push([]);
  }
  const keptStrides = computeStrides(keptShape);
  forEachIndex(a.shape, (index) => {
    let group = 0;
    for (let axis = 0; axis < index.length; axis++) {
      if (!reduced.includes(axis)) {
        group += index[axis]! * keptStrides[axis]!;
      }
    }
    groups[group]!.push(a.at(index));
  });

  const values = groups.map((group) => {
    if (kind === "max") {
      return Math.max(...group);
    }
    if (kind === "argmax") {
      return group.indexOf(Math.max(...group));
    }
    let total = 0;
    for (const value of group) {
      total += value;
    }
    return kind === "mean" ? total / groupSize : total;
  });

  const shape = keepdims ? keptShape : a.shape.filter((_, axis) => !reduced.includes(axis));
  const dtype = kind === "argmax" ? "int64" : a.dtype === "int64" && kind !== "mean" ? "int64" : "float64";
  return NDArray.fromValues(values, shape, dtype);
}

function einsum(subscripts: string, ...operands: NDArray[]): NDArray {
  const [inputPart, outputLetters] = subscripts.split("->") as [string, string];
  const inputLetters = inputPart.split(",");

  const sizes = new Map<string, number>();
  inputLetters.forEach((letters, k) => {
    [...letters].forEach((letter, axis) => {
      const size = operands[k]!.shape[axis]!;
      const seen = sizes.get(letter);
      if (seen !== undefined && seen !== size) {
        throw new Error(`einsum: label ${letter} has sizes ${seen} and ${size}`);
      }
      sizes.set(letter, size);
    });
  });

  const allLetters = [...new Set(inputPart.replace(/,/g, ""))];
  const loopShape = allLetters.map((letter) => sizes.get(letter)!);
  const outputShape = [...outputLetters].map((letter) => sizes.get(letter)!);
  const outputStrides = computeStrides(outputShape);
  const output = new Float64Array(product(outputShape));

  const operandPositions = inputLetters.map((letters) =>
    [...letters].map((letter) => allLetters.indexOf(letter)),
  );
  const outputPositions = [...outputLetters].map((letter) => allLetters.indexOf(letter));

  forEachIndex(loopShape, (index) => {
    let term = 1;
    operands.forEach((operand, k) => {
      term *= operand.at(operandPositions[k]!.map((position) => index[position]!));
    });
    let flat = 0;
    outputPositions.forEach((position, axis) => {
      flat += index[position]! * outputStrides[axis]!;
    });
    output[flat]! += term;
  });

  return new NDArray(output, outputShape, "float64");
}

function matmul(a: NDArray, b: NDArray): NDArray {
  if (a.shape.length === 3) {
    return einsum("bij,bjk->bik", a, b);
  }
  if (b.shape.length === 1) {
    return einsum("ij,j->i", a, b);
  }
  if (a.shape.length === 1) {
    return einsum("i,ij->j", a, b);
  }
  return einsum("ij,jk->ik", a, b);
}

function dot(a: number[], b: number[]): number {
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    total += a[i]! * b[i]!;
  }
  return total;
}

function allclose(a: NDArray, b: NDArray): boolean {
  const left = a.toValues();
  const right = b.toValues();
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, i) => Math.abs(value - right[i]!) <= 1e-8 + 1e-5 * Math.abs(right[i]!));
}

class Tensor {
  private _data: number[];
  private _shape: number[];
  private _strides: number[];
  private _isFloat: boolean;

  constructor(data: Nested | NDArray, shape?: number[]) {
    if (Array.isArray(data)) {
      [this._data, this._shape] = this._flattenNested(data);
    } else if (data instanceof NDArray) {
      this._data = data.toValues();
      this._shape = [...data.shape];
    } else {
      this._data = [data];
      this._shape = [];
    }
    this._isFloat = this._data.some((value) => !Number.isInteger(value));

    if (shape !== undefined) {
      const total = product(shape);
      if (total !== this._data.length) {
        throw new Error(`Cannot reshape ${this._data.length} elements into shape ${pyShape(shape)}`);
      }
      this._shape = [...shape];
    }

    this._strides = Tensor._computeStrides(this._shape);
  }

  private static fromParts(data: number[], shape: number[], isFloat: boolean): Tensor {
    const result = new Tensor(data, shape);
    result._isFloat = isFloat;
    return result;
  }

  private _flattenNested(data: Nested): [number[], number[]] {
    if (!Array.isArray(data)) {
      return [[data], []];
    }
    if (data.length === 0) {
      return [[], [0]];
    }

    const subResults = data.map((item) => this._flattenNested(item));
    const subShape = subResults[0]![1];
    subResults.forEach(([, s], i) => {
      if (pyShape(s) !== pyShape(subShape)) {
        throw new Error(`Inconsistent shapes at index ${i}: ${pyShape(s)} vs ${pyShape(subShape)}`);
      }
    });

    const flat: number[] = [];
    for (const [subData] of subResults) {
      flat.push(...subData);
    }

    return [flat, [data.length, ...subShape]];
  }

  private static _computeStrides(shape: number[]): number[] {
    return computeStrides(shape);
  }

  get shape(): number[] {
    return this._shape;
  }

  get rank(): number {
    return this._shape.length;
  }

  get size(): number {
    return this._data.length;
  }

  get strides(): number[] {
    return this._strides;
  }

  get isFloat(): boolean {
    return this._isFloat;
  }

  private _flatIndex(indices: number[]): number {
    if (indices.length !== this._shape.length) {
      throw new Error(`Expected ${this._shape.length} indices, got ${indices.length}`);
    }
    let idx = 0;
    indices.forEach((ind, i) => {
      if (ind < 0 || ind >= this._shape[i]!) {
        throw new Error(`Index ${ind} out of range for axis ${i} with size ${this._shape[i]}`);
      }
      idx += ind * this._strides[i]!;
    });
    return idx;
  }

  get(...indices: number[]): number {
    if (indices.length === this._shape.length) {
      return this._data[this._flatIndex(indices)]!;
    }
    throw new Error("Partial indexing not supported in this basic implementation");
  }

  set(indices: number[], value: number): void {
    this._data[this._flatIndex(indices)] = value;
  }

  reshape(newShape: number[]): Tensor {
    const shape = [...newShape];
    let negIdx = -1;
    let knownProduct = 1;
    shape.forEach((s, i) => {
      if (s === -1) {
        if (negIdx !== -1) {
          throw new Error("Only one dimension can be -1");
        }
        negIdx = i;
      } else {
        knownProduct *= s;
      }
    });

    if (negIdx !== -1) {
      shape[negIdx] = Math.floor(this.size / knownProduct);
    }

    if (product(shape) !== this.size) {
      throw new Error(`Cannot reshape ${this.size} elements into shape ${pyShape(shape)}`);
    }

    return Tensor.fromParts(this._data.slice(), shape, this._isFloat);
  }

  squeeze(dim?: number): Tensor {
    if (dim !== undefined) {
      if (dim < 0) {
        dim += this._shape.length;
      }
      if (this._shape[dim] !== 1) {
        return this.reshape(this._shape);
      }
      const newShape = [...this._shape];
      newShape.splice(dim, 1);
      return this.reshape(newShape);
    }
    return this.reshape(this._shape.filter((s) => s !== 1));
  }

  unsqueeze(dim: number): Tensor {
    const position = dim < 0 ? this._shape.length + 1 + dim : dim;
    const newShape = [...this._shape];
    newShape.splice(position, 0, 1);
    return this.reshape(newShape);
  }

  transpose(dim0: number, dim1: number): Tensor {
    const perm = this._shape.map((_, i) => i);
    [perm[dim0], perm[dim1]] = [perm[dim1]!, perm[dim0]!];
    return this.permute(perm);
  }

  permute(dims: number[]): Tensor {
    const sorted = [...dims].sort((a, b) => a - b);
    if (sorted.some((d, i) => d !== i) || dims.length !== this.rank) {
      throw new Error(`Invalid permutation ${pyShape(dims)} for rank ${this.rank}`);
    }

    const newShape = dims.map((d) => this._shape[d]!);
    const newStrides = Tensor._computeStrides(newShape);
    const newData = new Array<number>(this.size).fill(0);

    const oldStrides = this._strides;
    forEachIndex(this._shape, (oldIndices) => {
      const newIndices = dims.map((d) => oldIndices[d]!);
      let oldFlat = 0;
      oldIndices.forEach((i, axis) => {
        oldFlat += i * oldStrides[axis]!;
      });
      let newFlat = 0;
      newIndices.forEach((i, axis) => {
        newFlat += i * newStrides[axis]!;
      });
      newData[newFlat] = this._data[oldFlat]!;
    });

    return Tensor.fromParts(newData, newShape, this._isFloat);
  }

  flatten(startDim = 0, endDim = -1): Tensor {
    const end = endDim < 0 ? this.rank + endDim : endDim;
    const newShape = [
      ...this._shape.slice(0, startDim),
      product(this._shape.slice(startDim, end + 1)),
      ...this._shape.slice(end + 1),
    ];
    return this.reshape(newShape);
  }

  private _elementwiseOp(other: Tensor | number, op: (a: number, b: number) => number): Tensor {
    if (typeof other === "number") {
      const resultData = this._data.map((x) => op(x, other));
      return Tensor.fromParts(resultData, this._shape, this._isFloat || !Number.isInteger(other));
    }
    if (pyShape(this._shape) !== pyShape(other._shape)) {
      throw new Error(
        `Shape mismatch: ${pyShape(this._shape)} vs ${pyShape(other._shape)}. Use broadcast() first.`,
      );
    }
    const resultData = this._data.map((a, i) => op(a, other._data[i]!));
    return Tensor.fromParts(resultData, this._shape, this._isFloat || other._isFloat);
  }

  add(other: Tensor | number): Tensor {
    return this._elementwiseOp(other, (a, b) => a + b);
  }

  mul(other: Tensor | number): Tensor {
    return this._elementwiseOp(other, (a, b) => a * b);
  }

  sub(other: Tensor | number): Tensor {
    return this._elementwiseOp(other, (a, b) => a - b);
  }

  sum(): number;
  sum(axis: number): Tensor;
  sum(axis?: number): number | Tensor {
    if (axis === undefined) {
      let total = 0;
      for (const value of this._data) {
        total += value;
      }
      return total;
    }
    const position = axis < 0 ? this.rank + axis : axis;
    const newShape = [...this._shape];
    newShape.splice(position, 1);

    const resultData = new Array<number>(product(newShape)).fill(0);
    const resultStrides = Tensor._computeStrides(newShape);

    forEachIndex(this._shape, (indices) => {
      let oldFlat = 0;
      indices.forEach((i, a) => {
        oldFlat += i * this._strides[a]!;
      });
      const newIndices = [...indices.slice(0, position), ...indices.slice(position + 1)];
      let newFlat = 0;
      newIndices.forEach((i, a) => {
        newFlat += i * resultStrides[a]!;
      });
      resultData[newFlat]! += this._data[oldFlat]!;
    });

    return Tensor.fromParts(resultData, newShape, true);
  }

  toList(): Nested {
    if (this.rank === 0) {
      return this._data[0]!;
    }
    return this._buildNested(this._data, this._shape, 0);
  }

  private _buildNested(data: number[], shape: number[], offset: number): Nested[] {
    if (shape.length === 1) {
      return data.slice(offset, offset + shape[0]!);
    }
    const result: Nested[] = [];
    const stride = product(shape.slice(1));
    for (let i = 0; i < shape[0]!; i++) {
      result.push(this._buildNested(data, shape.slice(1), offset + i * stride));
    }
    return result;
  }

  listText(): string {
    return formatNested(this.toList(), this._isFloat);
  }

  toString(): string {
    return `Tensor(shape=${pyShape(this._shape)}, data=${this.listText()})`;
  }

  toNumpy(): NDArray {
    return NDArray.fromValues(this._data, this._shape, this._isFloat ? "float64" : "int64");
  }
}

function printHeader(title: string): void {
  console.log("=".repeat(60));
  console.log(title);
  console.log("=".repeat(60));
}

function range(count: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    values.push(i);
  }
  return values;
}

function demoBasicTensor(): void {
  printHeader("BASIC TENSOR OPERATIONS");

  const scalar = new Tensor(3.14);
  console.log(`Scalar: shape=${pyShape(scalar.shape)}, rank=${scalar.rank}, value=${scalar.listText()}`);

  const vector = new Tensor([1, 2, 3, 4, 5]);
  console.log(`Vector: shape=${pyShape(vector.shape)}, rank=${vector.rank}`);

  const matrix = new Tensor([[1, 2, 3], [4, 5, 6]]);
  console.log(`Matrix: shape=${pyShape(matrix.shape)}, rank=${matrix.rank}`);
  console.log(`  matrix[0, 1] = ${matrix.get(0, 1)}`);
  console.log(`  matrix[1, 2] = ${matrix.get(1, 2)}`);

  const tensor3d = new Tensor([[[1, 2], [3, 4]], [[5, 6], [7, 8]]]);
  console.log(`3D Tensor: shape=${pyShape(tensor3d.shape)}, rank=${tensor3d.rank}`);
  console.log(`  tensor[1, 0, 1] = ${tensor3d.get(1, 0, 1)}`);

  console.log(`\nStrides for shape ${pyShape(matrix.shape)}: ${pyShape(matrix.strides)}`);
  console.log(`Strides for shape ${pyShape(tensor3d.shape)}: ${pyShape(tensor3d.strides)}`);
  console.log();
}

function demoReshapeOperations(): void {
  printHeader("RESHAPE OPERATIONS");

  const data = new Tensor(range(12), [2, 6]);
  console.log(`Original: shape=${pyShape(data.shape)}`);
  console.log(`  ${data.listText()}`);

  const r1 = data.reshape([3, 4]);
  console.log(`\nReshaped to (3, 4): ${r1.listText()}`);

  const r2 = data.reshape([2, 2, 3]);
  console.log(`Reshaped to (2, 2, 3): ${r2.listText()}`);

  const r3 = data.reshape([-1, 3]);
  console.log(`Reshaped to (-1, 3): shape=${pyShape(r3.shape)}, ${r3.listText()}`);

  const t = new Tensor(range(6), [1, 3, 1, 2]);
  console.log(`\nBefore squeeze: shape=${pyShape(t.shape)}`);
  const s = t.squeeze();
  console.log(`After squeeze():  shape=${pyShape(s.shape)}`);
  const s0 = t.squeeze(0);
  console.log(`After squeeze(0): shape=${pyShape(s0.shape)}`);

  const v = new Tensor([1, 2, 3]);
  console.log(`\nVector shape: ${pyShape(v.shape)}`);
  console.log(`unsqueeze(0): ${pyShape(v.unsqueeze(0).shape)}`);
  console.log(`unsqueeze(1): ${pyShape(v.unsqueeze(1).shape)}`);
  console.log(`unsqueeze(-1): ${pyShape(v.unsqueeze(-1).shape)}`);

  const mat = new Tensor(range(6), [2, 3]);
  console.log(`\nOriginal: shape=${pyShape(mat.shape)}, ${mat.listText()}`);
  const tr = mat.transpose(0, 1);
  console.log(`Transpose(0,1): shape=${pyShape(tr.shape)}, ${tr.listText()}`);

  const t4d = new Tensor(range(24), [1, 2, 3, 4]);
  const perm = t4d.permute([0, 2, 3, 1]);
  console.log(`\nPermute (1,2,3,4) -> (0,2,3,1): ${pyShape(t4d.shape)} -> ${pyShape(perm.shape)}`);

  const batchConv = new Tensor(range(2 * 4 * 4 * 2), [2, 4, 4, 2]);
  const flat = batchConv.flatten(1);
  console.log(`\nFlatten (2,4,4,2) from dim 1: shape=${pyShape(flat.shape)}`);
  console.log();
}

function demoBroadcastingNumpy(): void {
  printHeader("BROADCASTING (NumPy)");

  console.log("\n--- Adding bias to batch ---");
  const activations = NDArray.randn([4, 3]);
  const bias = NDArray.fromValues([0.1, 0.2, 0.3], [3]);
  let result = add(activations, bias);
  console.log(`activations: ${pyShape(activations.shape)}`);
  console.log(`bias:        ${pyShape(bias.shape)}`);
  console.log(`result:      ${pyShape(result.shape)}`);

  console.log("\n--- Channel-wise scaling ---");
  const images = NDArray.randn([2, 3, 4, 4]);
  const scale = NDArray.fromValues([0.5, 1.0, 1.5], [3]).reshape([1, 3, 1, 1]);
  result = mul(images, scale);
  console.log(`images: ${pyShape(images.shape)}`);
  console.log(`scale:  ${pyShape(scale.shape)}`);
  console.log(`result: ${pyShape(result.shape)}`);

  console.log("\n--- Outer product via broadcasting ---");
  const a = NDArray.fromValues([1, 2, 3], [3], "int64").reshape([-1, 1]);
  const b = NDArray.fromValues([10, 20, 30, 40], [4], "int64").reshape([1, -1]);
  const outer = mul(a, b);
  console.log(`a: ${pyShape(a.shape)}, b: ${pyShape(b.shape)}`);
  console.log(`outer product: ${pyShape(outer.shape)}`);
  console.log(String(outer));

  console.log("\n--- Pairwise distances via broadcasting ---");
  const pointsA = NDArray.randn([5, 2]);
  const pointsB = NDArray.randn([3, 2]);
  const diff = sub(pointsA.reshape([5, 1, 2]), pointsB.reshape([1, 3, 2]));
  const distances = reduce(mul(diff, diff), "sum", [-1]).map(Math.sqrt);
  console.log(`points_a: ${pyShape(pointsA.shape)}`);
  console.log(`points_b: ${pyShape(pointsB.shape)}`);
  console.log(`diff:     ${pyShape(diff.shape)}`);
  console.log(`distances: ${pyShape(distances.shape)}`);

  console.log("\n--- Broadcasting rules check ---");
  const shapesToTest: [number[], number[]][] = [
    [[8, 1, 6, 1], [7, 1, 5]],
    [[3, 4], [4]],
    [[2, 1, 3], [1, 4, 3]],
    [[3, 1], [1, 4]],
  ];
  for (const [sa, sb] of shapesToTest) {
    const za = NDArray.full(sa, 0);
    const zb = NDArray.full(sb, 0);
    try {
      const sum = add(za, zb);
      console.log(`  ${pyShape(sa)} + ${pyShape(sb)} -> ${pyShape(sum.shape)}`);
    } catch (error) {
      console.log(`  ${pyShape(sa)} + ${pyShape(sb)} -> ERROR: ${(error as Error).message}`);
    }
  }

  console.log();
}

function demoEinsum(): void {
  printHeader("EINSUM NOTATION");

  console.log("\n--- Dot product: i,i-> ---");
  let a = NDArray.fromValues([1.0, 2.0, 3.0], [3]);
  let b = NDArray.fromValues([4.0, 5.0, 6.0], [3]);
  let result = einsum("i,i->", a, b);
  console.log(`  einsum: ${result}, np.dot: ${pyFloat(dot(a.toValues(), b.toValues()))}`);

  console.log("\n--- Outer product: i,j->ij ---");
  a = NDArray.fromValues([1.0, 2.0, 3.0], [3]);
  b = NDArray.fromValues([10.0, 20.0], [2]);
  result = einsum("i,j->ij", a, b);
  let verify = mul(a.reshape([3, 1]), b.reshape([1, 2]));
  console.log(`  einsum:\n${result}`);
  console.log(`  np.outer:\n${verify}`);

  console.log("\n--- Matrix multiply: ik,kj->ij ---");
  const A = NDArray.fromRows([[1, 2], [3, 4], [5, 6]], "float64");
  const B = NDArray.fromRows([[7, 8, 9], [10, 11, 12]], "float64");
  result = einsum("ik,kj->ij", A, B);
  verify = matmul(A, B);
  console.log(`  A: ${pyShape(A.shape)}, B: ${pyShape(B.shape)}`);
  console.log(`  einsum result:\n${result}`);
  console.log(`  matmul result:\n${verify}`);

  console.log("\n--- Trace: ii-> ---");
  const M = NDArray.fromRows([[1, 2, 3], [4, 5, 6], [7, 8, 9]], "float64");
  result = einsum("ii->", M);
  let trace = 0;
  for (let i = 0; i < 3; i++) {
    trace += M.at([i, i]);
  }
  console.log(`  einsum: ${result}, np.trace: ${pyFloat(trace)}`);

  console.log("\n--- Transpose: ij->ji ---");
  result = einsum("ij->ji", A);
  console.log(`  einsum:\n${result}`);

  console.log("\n--- Diagonal: ii->i ---");
  result = einsum("ii->i", M);
  verify = NDArray.fromValues([0, 1, 2].map((i) => M.at([i, i])), [3]);
  console.log(`  einsum: ${result}, np.diag: ${verify}`);

  console.log("\n--- Sum over axis: ij->i (row sums) ---");
  result = einsum("ij->i", A);
  verify = reduce(A, "sum", [1]);
  console.log(`  einsum: ${result}, sum(axis=1): ${verify}`);

  console.log("\n--- Batch matrix multiply: bij,bjk->bik ---");
  const batchA = NDArray.randn([4, 3, 5]);
  const batchB = NDArray.randn([4, 5, 2]);
  result = einsum("bij,bjk->bik", batchA, batchB);
  verify = batchMatmulByLoops(batchA, batchB);
  console.log(`  batch_A: ${pyShape(batchA.shape)}, batch_B: ${pyShape(batchB.shape)}`);
  console.log(`  einsum result: ${pyShape(result.shape)}`);
  console.log(`  matmul result: ${pyShape(verify.shape)}`);
  console.log(`  match: ${pyBool(allclose(result, verify))}`);

  console.log("\n--- Hadamard (element-wise) product: ij,ij->ij ---");
  const C = NDArray.fromRows([[1, 2], [3, 4]], "float64");
  const D = NDArray.fromRows([[5, 6], [7, 8]], "float64");
  result = einsum("ij,ij->ij", C, D);
  verify = mul(C, D);
  console.log(`  einsum:\n${result}`);
  console.log(`  element-wise:\n${verify}`);

  console.log();
}

function batchMatmulByLoops(a: NDArray, b: NDArray): NDArray {
  const [batch, rows, inner] = a.shape as [number, number, number];
  const cols = b.shape[2]!;
  const values: number[] = [];
  for (let n = 0; n < batch; n++) {
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        let total = 0;
        for (let k = 0; k < inner; k++) {
          total += a.at([n, i, k]) * b.at([n, k, j]);
        }
        values.push(total);
      }
    }
  }
  return NDArray.fromValues(values, [batch, rows, cols]);
}

function softmax(x: NDArray, axis = -1): NDArray {
  const shifted = sub(x, reduce(x, "max", [axis], true));
  const e = shifted.map(Math.exp);
  return div(e, reduce(e, "sum", [axis], true));
}

function demoAttentionEinsum(): void {
  printHeader("ATTENTION MECHANISM via EINSUM");

  const B = 2;
  const H = 4;
  const T = 8;
  const D = 16;
  const E = H * D;

  seed(42);

  const X = NDArray.randn([B, T, E]);
  console.log(`Input X: ${pyShape(X.shape)}  (batch, seq_len, embed_dim)`);

  const Wq = mul(NDArray.randn([E, E]), 0.02);
  const Wk = mul(NDArray.randn([E, E]), 0.02);
  const Wv = mul(NDArray.randn([E, E]), 0.02);

  let Q = einsum("bte,ek->btk", X, Wq);
  let K = einsum("bte,ek->btk", X, Wk);
  let V = einsum("bte,ek->btk", X, Wv);
  console.log(`Q, K, V: ${pyShape(Q.shape)}`);

  Q = Q.reshape([B, T, H, D]).transpose([0, 2, 1, 3]);
  K = K.reshape([B, T, H, D]).transpose([0, 2, 1, 3]);
  V = V.reshape([B, T, H, D]).transpose([0, 2, 1, 3]);
  console.log(`After split heads: Q=${pyShape(Q.shape)}, K=${pyShape(K.shape)}, V=${pyShape(V.shape)}`);

  const scores = div(einsum("bhtd,bhsd->bhts", Q, K), Math.sqrt(D));
  console.log(`Attention scores: ${pyShape(scores.shape)}`);

  const weights = softmax(scores, -1);
  console.log(`Attention weights: ${pyShape(weights.shape)}`);
  let rowSum = 0;
  for (let s = 0; s < T; s++) {
    rowSum += weights.at([0, 0, 0, s]);
  }
  console.log(`  weights sum per query (should be 1.0): ${rowSum.toFixed(6)}`);

  const attnOutput = einsum("bhts,bhsd->bhtd", weights, V);
  console.log(`Attention output: ${pyShape(attnOutput.shape)}`);

  const concat = attnOutput.transpose([0, 2, 1, 3]).reshape([B, T, E]);
  console.log(`Concatenated heads: ${pyShape(concat.shape)}`);

  const Wo = mul(NDArray.randn([E, E]), 0.02);
  const output = einsum("bte,ek->btk", concat, Wo);
  console.log(`Final output: ${pyShape(output.shape)}`);
  console.log();
}

function demoMemoryLayout(): void {
  printHeader("MEMORY LAYOUT");

  const a = NDArray.fromRows([[1, 2, 3], [4, 5, 6]]);
  console.log(`Array shape: ${pyShape(a.shape)}`);
  console.log(`Strides (bytes): ${pyShape(a.byteStrides)}`);
  console.log(`Strides (elements): ${pyShape(a.strides)}`);
  console.log(`C-contiguous: ${pyBool(a.isCContiguous())}`);
  console.log(`F-contiguous: ${pyBool(a.isFContiguous())}`);
  console.log(`Memory layout: ${a.ravel()}`);

  console.log("\n--- After transpose ---");
  const b = a.T;
  console.log(`Transposed shape: ${pyShape(b.shape)}`);
  console.log(`Strides (bytes): ${pyShape(b.byteStrides)}`);
  console.log(`C-contiguous: ${pyBool(b.isCContiguous())}`);
  console.log(`F-contiguous: ${pyBool(b.isFContiguous())}`);
  console.log("Note: transpose swapped strides without moving data");

  console.log("\n--- Contiguous copy ---");
  const c = b.copyContiguous();
  console.log("After ascontiguousarray:");
  console.log(`  C-contiguous: ${pyBool(c.isCContiguous())}`);
  console.log(`  Strides: ${pyShape(c.byteStrides)}`);

  console.log("\n--- Row-major vs Column-major ---");
  const rowMajor = NDArray.fromRows([[1, 2, 3], [4, 5, 6]], "int64", "C");
  const colMajor = NDArray.fromRows([[1, 2, 3], [4, 5, 6]], "int64", "F");
  console.log(`Row-major (C) flat: ${rowMajor.ravel("K")}`);
  console.log(`Col-major (F) flat: ${colMajor.ravel("K")}`);
  console.log(`Row-major strides: ${pyShape(rowMajor.byteStrides)}`);
  console.log(`Col-major strides: ${pyShape(colMajor.byteStrides)}`);

  console.log("\n--- Stride tricks: creating a view ---");
  const x = NDArray.arange(12).reshape([3, 4]);
  console.log(`Original:\n${x}`);
  console.log(`Strides: ${pyShape(x.byteStrides)}`);
  const sliced = x.everyOther(1, 2);
  console.log(`Every other column (x[:, ::2]):\n${sliced}`);
  console.log(`Sliced strides: ${pyShape(sliced.byteStrides)}`);
  console.log(`Sliced is contiguous: ${pyBool(sliced.isCContiguous())}`);
  console.log();
}

function megabytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

function withCommas(value: number): string {
  return value.toLocaleString("en-US");
}

function demoAiTensorShapes(): void {
  printHeader("COMMON AI TENSOR SHAPES");

  console.log("\n--- Vision: (B, C, H, W) ---");
  let B = 32;
  const C = 3;
  const H = 224;
  const W = 224;
  const images = NDArray.randn([B, C, H, W], "float32");
  console.log(`Image batch: ${pyShape(images.shape)}`);
  console.log(`  Total elements: ${withCommas(images.size)}`);
  console.log(`  Memory (float32): ${megabytes(images.nbytes)} MB`);

  const kernel = NDArray.randn([64, 3, 3, 3], "float32");
  console.log(`Conv2D kernel (64 filters, 3x3): ${pyShape(kernel.shape)}`);

  console.log("\n--- NLP: (B, T, D) ---");
  B = 16;
  let T = 512;
  let D = 768;
  const embeddings = NDArray.randn([B, T, D], "float32");
  console.log(`Token embeddings: ${pyShape(embeddings.shape)}`);
  console.log(`  Total elements: ${withCommas(embeddings.size)}`);
  console.log(`  Memory (float32): ${megabytes(embeddings.nbytes)} MB`);

  const vocabSize = 50257;
  const embedTable = NDArray.randn([vocabSize, D], "float32");
  console.log(`Embedding table (GPT-2): ${pyShape(embedTable.shape)}`);
  console.log(`  Memory: ${megabytes(embedTable.nbytes)} MB`);

  console.log("\n--- Attention: (B, H, T, D_head) ---");
  let heads = 12;
  let dHead = Math.floor(D / heads);
  const Q = NDArray.randn([B, heads, T, dHead], "float32");
  console.log(`Query tensor: ${pyShape(Q.shape)}`);
  console.log(`  Head dim: ${dHead}`);
  const attnScores = NDArray.randn([B, heads, T, T], "float32");
  console.log(`Attention scores: ${pyShape(attnScores.shape)}`);
  console.log(`  Memory: ${megabytes(attnScores.nbytes)} MB`);

  console.log("\n--- Weight shapes ---");
  const shapes: [string, number[]][] = [
    ["Linear (768 -> 3072)", [3072, 768]],
    ["Linear (3072 -> 768)", [768, 3072]],
    ["Conv2D (3->64, 7x7)", [64, 3, 7, 7]],
    ["Conv2D (64->128, 3x3)", [128, 64, 3, 3]],
    ["LayerNorm (768)", [768]],
    ["Embedding (50257, 768)", [50257, 768]],
    ["Positional (1024, 768)", [1024, 768]],
  ];
  for (const [name, shape] of shapes) {
    const params = product(shape);
    console.log(`  ${name}: ${pyShape(shape)} -> ${withCommas(params)} params`);
  }

  console.log("\n--- Layout conversion: NCHW <-> NHWC ---");
  const nchw = NDArray.randn([2, 3, 4, 4]);
  const nhwc = nchw.transpose([0, 2, 3, 1]);
  const back = nhwc.transpose([0, 3, 1, 2]);
  console.log(`NCHW: ${pyShape(nchw.shape)}`);
  console.log(`NHWC: ${pyShape(nhwc.shape)}`);
  console.log(`Back to NCHW: ${pyShape(back.shape)}`);
  console.log(`Round-trip match: ${pyBool(allclose(nchw, back))}`);

  console.log("\n--- Reshaping for multi-head attention ---");
  B = 4;
  T = 128;
  D = 768;
  heads = 12;
  dHead = Math.floor(D / heads);
  const x = NDArray.randn([B, T, D]);
  console.log(`Input: ${pyShape(x.shape)}`);

  const step1 = x.reshape([B, T, heads, dHead]);
  console.log(`After reshape to (B,T,H,D_head): ${pyShape(step1.shape)}`);

  const step2 = step1.transpose([0, 2, 1, 3]);
  console.log(`After transpose to (B,H,T,D_head): ${pyShape(step2.shape)}`);

  const step3 = step2.transpose([0, 2, 1, 3]).reshape([B, T, D]);
  console.log(`Merge heads back: ${pyShape(step3.shape)}`);
  console.log(`Round-trip match: ${pyBool(allclose(x, step3))}`);

  console.log();
}

function demoReductionOperations(): void {
  printHeader("REDUCTION OPERATIONS");

  const x = NDArray.randn([2, 3, 4]);
  console.log(`Input shape: ${pyShape(x.shape)}`);

  console.log(`\n  sum():           ${pyShape(reduce(x, "sum").shape)}`);
  console.log(`  sum(axis=0):     ${pyShape(reduce(x, "sum", [0]).shape)}`);
  console.log(`  sum(axis=1):     ${pyShape(reduce(x, "sum", [1]).shape)}`);
  console.log(`  sum(axis=2):     ${pyShape(reduce(x, "sum", [2]).shape)}`);
  console.log(`  sum(axis=(1,2)): ${pyShape(reduce(x, "sum", [1, 2]).shape)}`);

  console.log(`\n  mean(axis=0):    ${pyShape(reduce(x, "mean", [0]).shape)}`);
  console.log(`  max(axis=-1):    ${pyShape(reduce(x, "max", [-1]).shape)}`);
  console.log(`  argmax(axis=-1): ${pyShape(reduce(x, "argmax", [-1]).shape)}`);

  console.log("\n--- Global Average Pooling (vision) ---");
  const featureMap = NDArray.randn([2, 64, 7, 7]);
  let pooled = reduce(featureMap, "mean", [2, 3]);
  console.log(`  Feature map: ${pyShape(featureMap.shape)}`);
  console.log(`  After GAP:   ${pyShape(pooled.shape)}`);

  console.log("\n--- Sequence mean pooling (NLP) ---");
  const hiddenStates = NDArray.randn([4, 128, 768]);
  const mask = NDArray.full([4, 128, 1], 1);
  for (let b = 0; b < 4; b++) {
    for (let t = 100; t < 128; t++) {
      mask.set([b, t, 0], 0);
    }
  }
  pooled = div(reduce(mul(hiddenStates, mask), "sum", [1]), reduce(mask, "sum", [1]));
  console.log(`  Hidden states: ${pyShape(hiddenStates.shape)}`);
  console.log(`  Mask:          ${pyShape(mask.shape)}`);
  console.log(`  Pooled:        ${pyShape(pooled.shape)}`);

  console.log();
}

function demoCustomTensorClass(): void {
  printHeader("CUSTOM TENSOR CLASS DEMO");

  const t = new Tensor([[1, 2, 3], [4, 5, 6]]);
  console.log(`Created: ${t}`);
  console.log(`Shape: ${pyShape(t.shape)}, Rank: ${t.rank}, Size: ${t.size}`);
  console.log(`Strides: ${pyShape(t.strides)}`);
  console.log(`Element [1,2]: ${t.get(1, 2)}`);

  const r = t.reshape([3, 2]);
  console.log(`\nReshaped to (3,2): ${r}`);

  const r2 = t.reshape([-1]);
  console.log(`Flattened: ${r2}`);

  const u = t.unsqueeze(0);
  console.log(`\nUnsqueeze(0): shape=${pyShape(u.shape)}`);
  const s = u.squeeze(0);
  console.log(`Squeeze(0):   shape=${pyShape(s.shape)}`);

  const tr = t.transpose(0, 1);
  console.log(`\nTranspose: ${tr}`);

  const a = new Tensor([[1, 2], [3, 4]]);
  const b = new Tensor([[10, 20], [30, 40]]);
  console.log(`\na + b: ${a.add(b).listText()}`);
  console.log(`a * b: ${a.mul(b).listText()}`);
  console.log(`a * 2: ${a.mul(2).listText()}`);

  console.log(`\nSum all: ${formatNested(a.sum(), a.isFloat)}`);
  console.log(`Sum axis 0: ${a.sum(0).listText()}`);
  console.log(`Sum axis 1: ${a.sum(1).listText()}`);

  const npArr = t.toNumpy();
  console.log(`\nConverted to numpy: ${pyShape(npArr.shape)}`);

  const t3d = new Tensor([[[1, 2], [3, 4]], [[5, 6], [7, 8]]]);
  const perm = t3d.permute([2, 0, 1]);
  console.log(`\n3D tensor ${pyShape(t3d.shape)} permuted (2,0,1): ${pyShape(perm.shape)}`);
  console.log(`  ${perm.listText()}`);

  const flat = t3d.flatten(1);
  console.log(`Flatten from dim 1: ${pyShape(flat.shape)} -> ${flat.listText()}`);

  console.log();
}

function demoEinsumGallery(): void {
  printHeader("EINSUM GALLERY: ALL COMMON PATTERNS");

  const twoOperandOps: [string, string, number[], number[]][] = [
    ["Vector dot product", "i,i->", [4], [4]],
    ["Outer product", "i,j->ij", [3], [4]],
    ["Matrix-vector product", "ij,j->i", [3, 4], [4]],
    ["Matrix multiply", "ij,jk->ik", [3, 4], [4, 5]],
    ["Batch matmul", "bij,bjk->bik", [2, 3, 4], [2, 4, 5]],
    ["Batch outer product", "bi,bj->bij", [2, 3], [2, 4]],
    ["Frobenius norm squared", "ij,ij->", [3, 4], [3, 4]],
    ["Tensor contraction", "ijk,jkl->il", [2, 3, 4], [3, 4, 5]],
  ];

  const singleOperandOps: [string, string, number[]][] = [
    ["Trace", "ii->", [4, 4]],
    ["Diagonal", "ii->i", [4, 4]],
    ["Row sum", "ij->i", [3, 4]],
    ["Column sum", "ij->j", [3, 4]],
    ["Transpose", "ij->ji", [3, 4]],
  ];

  seed(0);
  for (const [name, subscripts, shapeA, shapeB] of twoOperandOps) {
    const a = NDArray.randn(shapeA);
    const b = NDArray.randn(shapeB);
    const result = einsum(subscripts, a, b);
    const resultShape = result.shape.length > 0 ? pyShape(result.shape) : "scalar";
    console.log(
      `  ${name.padEnd(30)}  ${subscripts.padEnd(15)}  ${pyShape(shapeA)} x ${pyShape(shapeB)} -> ${resultShape}`,
    );
  }

  for (const [name, subscripts, shapeA] of singleOperandOps) {
    const a = NDArray.randn(shapeA);
    const result = einsum(subscripts, a);
    const resultShape = result.shape.length > 0 ? pyShape(result.shape) : "scalar";
    console.log(`  ${name.padEnd(30)}  ${subscripts.padEnd(15)}  ${pyShape(shapeA)} -> ${resultShape}`);
  }

  console.log();
  console.log("--- Bilinear form (3-operand einsum): i,ij,j-> ---");
  const x = NDArray.fromValues([1.0, 2.0, 3.0], [3]);
  const W = NDArray.fromRows([[1, 0, 0], [0, 2, 0], [0, 0, 3]], "float64");
  const y = NDArray.fromValues([1.0, 1.0, 1.0], [3]);
  const result = einsum("i,ij,j->", x, W, y);
  const manual = dot(matmul(x, W).toValues(), y.toValues());
  console.log(`  x: ${pyShape(x.shape)}, W: ${pyShape(W.shape)}, y: ${pyShape(y.shape)}`);
  console.log(`  x^T W y = einsum: ${result}, manual: ${pyFloat(manual)}`);

  console.log();
}

demoCustomTensorClass();
demoBasicTensor();
demoReshapeOperations();
demoBroadcastingNumpy();
demoMemoryLayout();
demoEinsum();
demoEinsumGallery();
demoAttentionEinsum();
demoAiTensorShapes();
demoReductionOperations();
