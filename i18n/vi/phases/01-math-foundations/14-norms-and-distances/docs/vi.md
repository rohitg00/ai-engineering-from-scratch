# Các tiêu chuẩn và khoảng cách

> Chọn sai và mọi thứ sẽ bị phá vỡ.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 01 (Linear Algebra Intuition), 02 (Vectors, Matrices & Operations)
**Time:** ~90 minutes

## Mục tiêu học tập

- Thực hiện L1, L2, cosine, Mahalanobis, Jaccard, và chỉnh sửa các hàm khoảng cách từ đầu
- Chọn số liệu khoảng cách thích hợp cho một nhiệm vụ ML nhất định và giải thích lý do tại sao các thay thế thất bại
- Kết nối các tiêu chuẩn L1 và L2 với LASSO và Ridge và các khu vực hạn chế hình học của chúng
- Hiển thị cách cùng một tập dữ liệu tạo ra các hàng xóm gần nhất khác nhau dưới các số liệu khác nhau

## Vấn đề

Bạn có hai vector. Có thể chúng là word embeddings. Có thể là user profiles. Có thể là array pixel. Bạn cần phải biết: chúng gần nhau đến mức nào?

Câu trả lời hoàn toàn phụ thuộc vào hàm khoảng cách bạn chọn. Hai điểm dữ liệu có thể là hàng xóm gần nhất dưới một thước đo và xa nhau dưới một số khác. Bộ phân loại KNN của bạn, động cơ khuyến nghị của bạn, cơ sở dữ liệu vector của bạn, thuật toán nhóm của bạn, hàm mất mát của bạn - tất cả đều phụ thuộc vào sự lựa chọn này. Hãy sai lầm và mô hình của bạn tối ưu hóa cho điều sai lầm.

Không có khoảng cách tốt nhất phổ quát. L2 hoạt động cho dữ liệu không gian. Sự tương đồng cosine thống trị NLP. Jaccard xử lý tập hợp. Edit distance handles strings. Mahalanobis tính toán cho mối tương quan. Wasserstein di chuyển khối lượng xác suất. Mỗi một mã hóa một giả định khác về điều "tương tự" có nghĩa là gì.

Bài học này xây dựng mọi hàm khoảng cách lớn từ đầu, cho bạn thấy mỗi công cụ là công cụ phù hợp, và chứng minh cách cùng một dữ liệu tạo ra những người hàng xóm gần nhất hoàn toàn khác nhau tùy thuộc vào số liệu bạn sử dụng.

## Khái niệm

### Các chuẩn: đo lường độ lớn của vector

Một chuẩn đo "kích thước" của một vector. Mỗi hàm khoảng cách giữa hai vector có thể được viết là chuẩn của sự khác biệt của chúng:$d(a, b) = \lVert a - b \rVert$Vì vậy, hiểu các chuẩn mực là hiểu khoảng cách.

### L1 Norm (trường Manhattan)

Tỷ lệ L1 tổng hợp các giá trị tuyệt đối của tất cả các thành phần.

```math
\lVert x \rVert_1 = |x_1| + |x_2| + \cdots + |x_n|
```

Nó được gọi là khoảng cách Manhattan vì nó đo được bạn đi bao xa trên lưới thành phố mà bạn chỉ có thể di chuyển dọc theo trục. Không có đường chéo.

```
Point A = (1, 1)
Point B = (4, 5)

L1 distance = |4-1| + |5-1| = 3 + 4 = 7

On a grid, you walk 3 blocks east and 4 blocks north.
```

Khi nào sử dụng L1:
- Dữ liệu hiếm có chiều cao (chương vị văn bản, mã hóa đơn)
- Khi bạn muốn độ bền đến mức ngoại lệ (một sự khác biệt lớn không thống trị)
- Các vấn đề lựa chọn tính năng (L1 quy định thúc đẩy sự khan hiếm)

Kết nối với L1 regularization (Lasso): thêm $\lVert w \rVert_1$L1 hình phạt tạo ra các vùng hạn chế hình kim cương trong không gian trọng lượng, và các góc kim cương nằm trên các trục mà một số trọng lượng là không.

Kết nối với các chức năng mất mát: Phỏng lẻo tuyệt đối trung bình (MAE) là khoảng cách trung bình L1 giữa dự đoán và mục tiêu. Nó phạt tất cả các lỗi theo đường thẳng, làm cho nó mạnh mẽ đến các mức ngoại lệ so với MSE.

### L2 Norm (trường dài Euclidean)

L2 là đường thẳng đường dài.

```math
\lVert x \rVert_2 = \sqrt{x_1^2 + x_2^2 + \cdots + x_n^2}
```

Đây là khoảng cách mà bạn học trong lớp hình học.$n$kích thước.

```
Point A = (1, 1)
Point B = (4, 5)

L2 distance = sqrt((4-1)^2 + (5-1)^2) = sqrt(9 + 16) = sqrt(25) = 5.0

The straight line, cutting diagonally through the grid.
```

Khi nào sử dụng L2:
- Dữ liệu liên tục ở chiều thấp đến trung bình
- Khi các thang điểm tính năng có thể so sánh
- Khoảng cách vật lý (kết lượng dữ liệu không gian, đọc cảm biến)
- Sự tương đồng hình ảnh ở cấp độ pixel

Kết nối với L2 (Ridge): thêm $\lVert w \rVert_2^2$L1 không đẩy trọng lượng xuống 0, nó thu hẹp tất cả trọng lượng về phía 0, tỷ lệ tương ứng. L2 hình phạt tạo ra các khu vực hạn chế chu kỳ, do đó không có góc trên trục. trọng lượng trở nên nhỏ nhưng hiếm khi chính xác bằng 0.

Kết nối với các hàm mất mát: Phỏng lẻo bình phương trung bình (MSE) là trung bình của khoảng cách bình phương L2. Phản độ hình phạt lỗi lớn nặng hơn những lỗi nhỏ.

```math
\begin{aligned}
\text{MAE (L1 loss):} \quad & |y - \hat{y}| && \text{Linear penalty. Robust to outliers.} \\
\text{MSE (L2 loss):} \quad & (y - \hat{y})^2 && \text{Quadratic penalty. Sensitive to outliers.}
\end{aligned}
```

### Lp Norm: gia đình chung

L1 và L2 là các trường hợp đặc biệt của chuẩn Lp:

```math
\lVert x \rVert_p = (|x_1|^p + |x_2|^p + \cdots + |x_n|^p)^{1/p}
```

Các giá trị khác nhau của $p$tạo ra "cánh bóng đơn vị" có hình dạng khác nhau (số tất cả các điểm ở khoảng cách tối đa 1 từ nguồn gốc; hình dạng dưới đây là ranh giới của chúng):

```
p=1:    Diamond shape      (corners on axes)
p=2:    Circle/sphere      (the usual round ball)
p=3:    Superellipse       (rounded square)
p=inf:  Square/hypercube   (flat sides along axes)
```

### L-không giới hạn Norm (trường độ Chebyshev)

Như $p$tiếp cận vô hạn, chuẩn Lp hội tụ với thành phần tuyệt đối tối đa.

```math
\lVert x \rVert_\infty = \max(|x_1|, |x_2|, \ldots, |x_n|)
```

Khoảng cách giữa hai điểm được xác định bởi chiều kích duy nhất mà chúng khác nhau nhất.

```math
\begin{aligned}
\text{Point } A &= (1, 1) \\
\text{Point } B &= (4, 5) \\[6pt]
L_\infty \text{ distance} &= \max(|4-1|, |5-1|) = \max(3, 4) = 4
\end{aligned}
```

Khi nào sử dụng L- Infinity:
- Khi sự lệch điệu tồi tệ nhất trong bất kỳ chiều kích đơn lẻ nào quan trọng
- Các bảng chơi (một vua trong cờ vua di chuyển trong L- vô hạn: một bước theo bất kỳ hướng nào chi phí 1)
- Độ dung nạp sản xuất (mỗi kích thước phải nằm trong quy định)

### Sự tương đồng của cosine và khoảng cách cosine

Sự tương đồng cosine đo góc giữa hai vector, bỏ qua quy mô của chúng.

```math
\text{cos\_sim}(a, b) = \frac{a \cdot b}{\lVert a \rVert_2 \, \lVert b \rVert_2}
```

Nó dao động từ -1 (nghĩa ngược) đến +1 (nghĩa tương tự).

Khoảng cách cosine biến nó thành khoảng cách: cosine_distance = 1 - cosine_similarity.

```math
\begin{aligned}
& a = (1, 0) \qquad b = (1, 1) \\[6pt]
& \text{cos\_sim} = \frac{1 \cdot 1 + 0 \cdot 1}{1 \cdot \sqrt{2}} = \frac{1}{\sqrt{2}} = 0.707 \\
& \text{cos\_dist} = 1 - 0.707 = 0.293
\end{aligned}
```

Tại sao cosine thống trị NLP và nhúng: trong văn bản, chiều dài tài liệu không nên ảnh hưởng đến sự tương đồng. Một tài liệu về mèo dài gấp đôi tài liệu khác về mèo vẫn nên "tương tự". Sự tương tự của Cosine bỏ qua quy mô (giờ dài) và chỉ quan tâm đến hướng. Hai tài liệu với phân bố từ ngữ tương tự nhưng chiều dài khác nhau chỉ ra cùng một hướng và có sự tương đồng cosine 1.0.

Khi sử dụng sự tương tự cosine:
- Sự tương đồng văn bản (trường dẫn TF-IDF, nhúng từ, nhúng câu)
- Bất kỳ lĩnh vực nào mà độ lớn là tiếng ồn và hướng là tín hiệu
- Hệ thống khuyến nghị (những vector ưu tiên của người dùng)
- Nhập tìm kiếm (tổ dữ liệu vector hầu như luôn sử dụng cosine hoặc điểm sản phẩm)

### Sự tương đồng của sản phẩm điểm so với sự tương đồng của cosine

Kết quả điểm của hai vector là:

```math
\begin{aligned}
a \cdot b &= a_1 b_1 + a_2 b_2 + \cdots + a_n b_n \\
&= \lVert a \rVert \, \lVert b \rVert \cos(\text{angle})
\end{aligned}
```

Sự tương đồng của cosine là sản phẩm điểm được bình thường hóa bởi cả hai độ lớn. Khi cả hai vector đã được bình thường hóa đơn vị (tầm lớn = 1), sản phẩm điểm và sự tương đồng cosine là giống nhau.

```math
\text{If } \lVert a \rVert = 1 \text{ and } \lVert b \rVert = 1: \quad a \cdot b = \cos(\text{angle between } a \text{ and } b)
```

Khi chúng khác nhau: sản phẩm điểm bao gồm thông tin về quy mô. Một vector có quy mô lớn hơn có điểm điểm sản phẩm cao hơn. Điều này quan trọng trong một số hệ thống tìm kiếm nơi bạn muốn các mục "thân trọng" xếp hạng cao hơn.

```
a = (3, 0)    b = (1, 0)    c = (0, 1)

dot(a, b) = 3     dot(a, c) = 0
cos(a, b) = 1.0   cos(a, c) = 0.0

Both agree on direction, but dot product also reflects magnitude.
```

Trong thực tế:
- Sử dụng sự tương đồng cosine khi bạn muốn sự tương đồng hướng tinh khiết
- Sử dụng sản phẩm điểm khi quy mô mang thông tin có ý nghĩa
- Nhiều cơ sở dữ liệu vector (Pinecone, Weaviate, Qdrant) cho phép bạn chọn giữa chúng
- Nếu các nhúng của bạn là L2- bình thường, sự lựa chọn không quan trọng

### Khoảng cách của Mahalanobis

Khoảng cách Euclidean đối xử với tất cả các chiều kích bằng nhau. Nhưng nếu các tính năng của bạn tương quan hoặc có các thang khác nhau, L2 sẽ đưa ra kết quả sai lầm.

Khoảng cách Mahalanobis chiếm cấu trúc sự khác nhau của dữ liệu.

```math
d_M(x, y) = \sqrt{(x - y)^T S^{-1} (x - y)}
```

nơi $S$là matrix covariance của dữ liệu.

Nhìn trực quan: khoảng cách Mahalanobis trước tiên giải thích và bình thường hóa dữ liệu (tẩy trắng), sau đó tính khoảng cách L2 trong không gian biến đổi đó.$S$là các mô-trix danh tính (không liên quan, các tính năng biến thể đơn vị), khoảng cách của Mahalanobis giảm xuống khoảng cách Euclidean.

```
Example: height and weight are correlated.
Someone 6'2" and 180 lbs is not unusual.
Someone 5'0" and 180 lbs is unusual.

Euclidean distance might say they are equally far from the mean.
Mahalanobis distance correctly identifies the second as an outlier
because it accounts for the height-weight correlation.
```

Khi nào để sử dụng khoảng cách Mahalanobis:
- Khám phá ngoại lệ (điểm với khoảng cách lớn của Mahalanobis từ trung bình là ngoại lệ)
- Việc phân loại khi các tính năng có quy mô và tương quan khác nhau
- Khi bạn có đủ dữ liệu để ước tính một matrix covariance đáng tin cậy
- Kiểm soát chất lượng trong sản xuất (phòng dõi quá trình đa biến)

### Jaccard tương tự (đối với các bộ)

Các biện pháp tương đồng Jaccard chồng chéo giữa hai bộ.

```math
J(A, B) = \frac{|A \cap B|}{|A \cup B|}
```

Nó dao động từ 0 (không chồng chéo) đến 1 (các bộ giống nhau).

```
A = {cat, dog, fish}
B = {cat, bird, fish, snake}

Intersection = {cat, fish}         size = 2
Union = {cat, dog, fish, bird, snake}  size = 5

Jaccard similarity = 2/5 = 0.4
Jaccard distance = 0.6
```

Khi nào sử dụng Jaccard:
- So sánh các tập hợp thẻ, danh mục hoặc tính năng
- Sự tương đồng tài liệu dựa trên sự hiện diện của từ ngữ (không phải tần suất)
- Khám phá gần trùng lặp (MinHash gần Jaccard)
- So sánh các vector tính năng nhị phân (dữ liệu hiện diện/không có)
- Các mô hình phân đoạn đánh giá (Tạm dịch: giao cắt giữa Liên minh = Jaccard)

### Edit Distance (Levenshtein Distance)

Edit distance đếm số lượng tối thiểu các hoạt động đơn ký tự cần thiết để chuyển đổi một chuỗi thành một chuỗi khác.

```
"kitten" -> "sitting"

kitten -> sitten  (substitute k -> s)
sitten -> sittin  (substitute e -> i)
sittin -> sitting (insert g)

Edit distance = 3
```

Được tính bằng cách lập trình động. Sẵn sàng để nhập$(i, j)$là khoảng cách chỉnh sửa giữa đầu tiên $i$chữ cái của chuỗi A và chữ cái đầu tiên $j$Các ký tự của chuỗi B.

```
        ""  s  i  t  t  i  n  g
    ""   0  1  2  3  4  5  6  7
    k    1  1  2  3  4  5  6  7
    i    2  2  1  2  3  4  5  6
    t    3  3  2  1  2  3  4  5
    t    4  4  3  2  1  2  3  4
    e    5  5  4  3  2  2  3  4
    n    6  6  5  4  3  3  2  3
```

Khi nào để sử dụng edit distance:
- Kiểm tra và sửa chữa đánh pháp
- Định dạng chuỗi DNA (với các hoạt động trọng lượng)
- Đáp ứng dây vẫy
- Kích thước của dữ liệu văn bản lộn xộn

### KL Divergence (không phải là khoảng cách, nhưng được sử dụng như một)

KL phân biệt đo lường cách phân phối xác suất khác nhau như thế nào. được bao gồm trong Bài học 09, nhưng nó thuộc về cuộc thảo luận này bởi vì mọi người sử dụng nó như một "công xa" mặc dù nó không phải là một.

```math
D_{KL}(P \,\|\, Q) = \sum_x p(x) \log\frac{p(x)}{q(x)}
```

Tính chất quan trọng: Sự phân biệt KL KHÔNG đối xứng.

```math
D_{KL}(P \,\|\, Q) \ne D_{KL}(Q \,\|\, P)
```

Điều này có nghĩa là nó không đáp ứng được yêu cầu cơ bản của một số lượng đường dài. Nó cũng không đáp ứng được sự bất bình đẳng tam giác.

Chuyển KL $(D_{KL}(P \Vert Q))$là "đ tìm kiếm ý nghĩa": $Q$cố gắng bao gồm tất cả các phương thức của $P$- Tôi không biết.
Chuyển ngược KL $(D_{KL}(Q \Vert P))$là "mode-seeking": $Q$tập trung vào một cách duy nhất của $P$- Tôi không biết.

Khi bạn thấy sự khác biệt KL:
- VAEs (từ KL trong ELBO đẩy phân bố tiềm ẩn về phía trước)
- Sự phân phối kiến thức (những học sinh cố gắng để phù hợp với phân phối của giáo viên)
- RLHF (tình phạt KL giữ cho mô hình được điều chỉnh tốt gần với mô hình cơ bản)
- Các phương pháp gradient chính sách (khác định các cập nhật chính sách)

### Khoảng cách Wasserstein (Trong cách của người di chuyển Trái đất)

Khoảng cách của Wasserstein đo "phát" tối thiểu cần thiết để biến phân phối xác suất thành phân phối khác. Hãy nghĩ về nó như: nếu một phân phối là một đống bụi và một phần khác là một lỗ, bạn phải di chuyển bao nhiêu bụi và bao xa?

```math
W(P, Q) = \inf_{\gamma} \mathbb{E}[d(x, y)] \quad \text{(over all transport plans } \gamma\text{)}
```

Đối với phân phối 1D, nó đơn giản hóa thành phần tích hợp của sự khác biệt tuyệt đối của các hàm phân phối tích lũy:

```math
W_1(P, Q) = \int |\text{CDF}_P(x) - \text{CDF}_Q(x)| \, dx
```

Tại sao Wasserstein quan trọng:
- Nó là một métric thực (tương đối, đáp ứng bất bình đẳng tam giác)
- Nó cung cấp gradient ngay cả khi phân phối không chồng chéo (khiến độ KL đi đến vô hạn)
- Cất lượng này làm cho nó trở thành trung tâm của các GAN Wasserstein (WGAN), giải quyết sự bất ổn đào tạo của các GAN ban đầu

```
Distributions with no overlap:

P: [1, 0, 0, 0, 0]    Q: [0, 0, 0, 0, 1]

KL divergence: infinity (log of zero)
Wasserstein: 4 (move all mass 4 bins)

Wasserstein gives a meaningful gradient. KL does not.
```

Khi nào sử dụng Wasserstein:
- Việc đào tạo GAN (WGAN, WGAN-GP)
- So sánh phân bố không có sự chồng chéo
- Vấn đề vận tải tối ưu
- Khám ảnh (sự so sánh histogram màu)

### Tại sao việc làm khác nhau cần cách xa khác nhau

| Task | Best distance | Why |
|------|--------------|-----|
| Text similarity | Cosine | Magnitude is noise, direction is meaning |
| Image pixel comparison | L2 | Spatial relationships matter, features are comparable scale |
| Sparse high-dim features | L1 | Robust, does not amplify rare large differences |
| Set overlap (tags, categories) | Jaccard | Data is naturally set-valued, not vectorial |
| String matching | Edit distance | Operations map to human editing intuition |
| Outlier detection | Mahalanobis | Accounts for feature correlations and scales |
| Comparing distributions | KL divergence | Measures information lost by using $Q$ instead of $P$ |
| GAN training | Wasserstein | Provides gradients even when distributions do not overlap |
| Embeddings (vector DB) | Cosine or dot product | Embeddings are trained to encode meaning in direction |
| Recommendation | Dot product | Magnitude can encode popularity or confidence |
| DNA sequences | Weighted edit distance | Substitution costs vary by nucleotide pair |
| Manufacturing QC | L-infinity | Worst-case deviation in any dimension matters |

### Kết nối với các chức năng mất mát

Các hàm mất mát là các hàm khoảng cách được áp dụng cho dự đoán so với mục tiêu.

```
Loss function       Distance it uses       Behavior
MSE                 L2 squared             Penalizes large errors heavily
MAE                 L1                     Penalizes all errors equally
Huber loss          L1 for large errors,   Best of both: robust to outliers,
                    L2 for small errors    smooth gradient near zero
Cross-entropy       KL divergence          Measures distribution mismatch
Hinge loss          max(0, margin - d)     Only penalizes below margin
Triplet loss        L2 (typically)         Pulls positives close, pushes
                                           negatives away
Contrastive loss    L2                     Similar pairs close, dissimilar
                                           pairs beyond margin
```

### Kết nối với quy định

Việc quy định thêm một hình phạt chuẩn trên trọng lượng vào hàm mất.

```
L1 regularization (Lasso):   loss + lambda * ||w||_1
  -> Sparse weights. Some weights become exactly zero.
  -> Automatic feature selection.
  -> Solution has corners (non-differentiable at zero).

L2 regularization (Ridge):   loss + lambda * ||w||_2^2
  -> Small weights. All weights shrink toward zero.
  -> No feature selection (nothing goes to exactly zero).
  -> Smooth solution everywhere.

Elastic Net:                  loss + lambda_1 * ||w||_1 + lambda_2 * ||w||_2^2
  -> Combines sparsity of L1 with stability of L2.
  -> Groups of correlated features are kept or dropped together.
```

Tại sao L1 tạo ra sự thô lỗ nhưng L2 không tạo ra: hình dung khu vực hạn chế trong không gian trọng lượng 2D. L1 là kim cương, L2 là một vòng tròn. Các đường viền của hàm mất mát (các vòng tròn) có nhiều khả năng chạm vào kim cương ở góc, nơi một trọng lượng là không. Chúng chạm vào vòng tròn ở một điểm mịn, nơi cả hai trọng lượng là không bằng không.

### Tìm người hàng xóm gần nhất

Mỗi hàm khoảng cách có nghĩa là một vấn đề tìm kiếm hàng xóm gần nhất: với một điểm truy vấn, tìm các điểm gần nhất trong một tập dữ liệu.

Tìm kiếm hàng xóm gần nhất là$O(n \cdot d)$cho mỗi truy vấn trong một bộ dữ liệu của $n$điểm với $d$Đối với các tập dữ liệu lớn, điều này quá chậm.

Các thuật toán hàng xóm gần nhất (ANN) giao dịch một lượng nhỏ độ chính xác để tăng tốc độ lớn:

```
Algorithm         Approach                      Used by
KD-trees          Axis-aligned space partition   scikit-learn (low-dim)
Ball trees        Nested hyperspheres            scikit-learn (medium-dim)
LSH               Random hash projections        Near-duplicate detection
HNSW              Hierarchical navigable         FAISS, Qdrant, Weaviate
                  small-world graph
IVF               Inverted file index with       FAISS (billion-scale)
                  cluster-based search
Product quant.    Compress vectors, search       FAISS (memory-constrained)
                  in compressed space
```

HNSW (Hierarchical Navigable Small World) là thuật toán thống trị trong cơ sở dữ liệu vector hiện đại. Nó xây dựng một biểu đồ đa tầng nơi mỗi nút kết nối với hàng xóm gần nhất của nó. Tìm kiếm bắt đầu ở lớp trên (sparse, nhảy dài) và xuống tầng dưới (thiên, nhảy ngắn).

```figure
norm-unit-balls
```

## Hãy xây dựng nó

### Bước 1: Tất cả các chức năng chuẩn và khoảng cách

Nhìn xem`code/distances.py`cho việc thực hiện hoàn chỉnh. Mỗi hàm được xây dựng từ đầu chỉ sử dụng toán học Python cơ bản.`code/distances.ts`là một cổng TypeScript với các chức năng và demo tương tự.

### Bước 2: cùng dữ liệu, khoảng cách khác nhau, hàng xóm khác nhau

Demo trong `distances.py`tạo ra một bộ dữ liệu, chọn một điểm truy vấn, và cho thấy cách hàng xóm gần nhất thay đổi tùy thuộc vào thước đo khoảng cách. Điểm "gần nhất" dưới L1 có thể không gần nhất dưới L2 hoặc cosine.

### Bước 3: Nhập tìm kiếm tương đồng

Mã bao gồm một tìm kiếm tương đồng giả mạo nhúng tìm kiếm "bài liệu" tương tự nhất với một truy vấn sử dụng tương đồng cosine so với khoảng cách L2, cho thấy xếp hạng có thể khác nhau.

## Sử dụng nó

Sử dụng thực tế phổ biến nhất: tìm các mục tương tự trong cơ sở dữ liệu vector.

```python
import numpy as np

def cosine_similarity_matrix(X):
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    X_normalized = X / norms
    return X_normalized @ X_normalized.T

embeddings = np.random.randn(1000, 768)

sim_matrix = cosine_similarity_matrix(embeddings)

query_idx = 0
similarities = sim_matrix[query_idx]
top_k = np.argsort(similarities)[::-1][1:6]
print(f"Top 5 most similar to item 0: {top_k}")
print(f"Similarities: {similarities[top_k]}")
```

Khi anh gọi`model.encode(text)`và sau đó tìm kiếm một cơ sở dữ liệu vector, đây là những gì xảy ra dưới nắp. mô hình nhúng bản đồ văn bản cho vector. cơ sở dữ liệu vector tính toán sự tương đồng cosine (hoặc sản phẩm chấm) giữa vector truy vấn của bạn và mỗi vector lưu trữ, sử dụng thuật toán ANN để tránh kiểm tra tất cả chúng.

## Các bài tập

1. Xét khoảng cách L1, L2 và L- vô hạn giữa (1, 2, 3) và (4, 0, 6).$L_\infty \le L_2 \le L_1$Hãy chứng minh tại sao lệnh này được đảm bảo.

2. Tạo hai vector nơi sự tương đồng cosine là cao (> 0,9) nhưng khoảng cách L2 là lớn (> 10). Giải thích hình học những gì đang xảy ra.

3. Thực hiện một hàm lấy một tập dữ liệu và một điểm truy vấn và trả lại hàng xóm gần nhất dưới khoảng cách L1, L2, cosine và Mahalanobis. Tìm một tập dữ liệu mà cả bốn không đồng ý về điểm gần nhất.

4. Xét khoảng cách Wasserstein giữa [0,5, 0,5, 0,0] và [0, 0, 0,5, 0,5] bằng tay bằng phương pháp CDF. Sau đó tính nó giữa [0,25, 0,25, 0,25, 0,25] và [0, 0, 0, 0,5, 0.5].

5. Thực hiện MinHash để tương tự Jaccard gần như. Tạo 100 bộ ngẫu nhiên, tính toán chính xác Jaccard cho tất cả các cặp, và so sánh với sự gần gũi MinHash bằng cách sử dụng hàm hash 50, 100, và 200.

### Những gợi ý

**Exercise 1.**Dấu tích khác biệt là (-3, 2, -3), vì vậy tính toán ba quy tắc của dấu tích đó bằng `l1_norm`- `l2_norm`, và`linf_norm`Để chứng minh, so sánh lớn nhất$\lvert d_i \rvert$với tổng số vuông, và so sánh tổng số vuông với số vuông của tổng số giá trị tuyệt đối.

**Exercise 2.**Sự tương đồng cosine bỏ qua chiều dài, vì vậy hãy bắt đầu với hai vector chỉ ra gần như cùng một hướng và làm cho một trong số chúng dài hơn nhiều. Đối với trường hợp thứ hai, sử dụng hai vector ngắn gần nguồn chỉ ra các hướng khác nhau, sau đó kiểm tra cả hai điều kiện bằng `cosine_similarity`và `l2_distance`- Tôi không biết.

**Exercise 3.**Gọi`find_nearest_neighbor(query, dataset, distance_fn)`một lần cho mỗi người `l1_distance`- `l2_distance`- `cosine_distance`, và`mahalanobis_distance`- `demo_different_neighbors`cho thấy một tập dữ liệu mà các số liệu không đồng ý, vì vậy hãy đọc nó trước và sau đó thay đổi các điểm cho đến khi cả bốn câu trả lời khác nhau.

**Exercise 4.**Viết tổng cộng tích lũy của mỗi phân phối, sau đó thêm sự khác biệt tuyệt đối của hai tổng tích lũy.`wasserstein_1d(p, q)`, sau đó giải thích giá trị lớn hơn bằng cách cách khối lượng xác suất phải di chuyển xa như thế nào.

**Exercise 5.**Đối với mỗi hàm hash, chữ ký MinHash của một tập hợp là giá trị hash tối thiểu trên các yếu tố của nó, và phần của các hàm hash nơi hai tập hợp nhận được ước tính tối thiểu tương tự của họ. So sánh mỗi ước tính với `jaccard_similarity`; lỗi phải rơi vào khoảng như $1/\sqrt{k}$cho $k$hàm hash.

## Các điều khoản chính

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Norm | "Size of a vector" | A function that maps a vector to a non-negative scalar, satisfying triangle inequality, absolute homogeneity, and zero only for the zero vector |
| L1 norm | "Manhattan distance" | Sum of absolute component values. Produces sparsity in optimization. Robust to outliers |
| L2 norm | "Euclidean distance" | Square root of sum of squared components. The straight-line distance in Euclidean space |
| Lp norm | "Generalized norm" | The $p$-th root of the sum of $p$-th powers of absolute components. L1 and L2 are special cases |
| L-infinity norm | "Max norm" or "Chebyshev distance" | The maximum absolute component value. The limit of Lp as $p$ approaches infinity |
| Cosine similarity | "Angle between vectors" | Dot product normalized by both magnitudes. Ranges from -1 to +1. Ignores vector length |
| Cosine distance | "1 minus cosine similarity" | Converts cosine similarity to a distance. Ranges from 0 to 2 |
| Dot product | "Unnormalized cosine" | Sum of component-wise products. Equals cosine similarity times both magnitudes |
| Mahalanobis distance | "Correlation-aware distance" | L2 distance in a space that has been whitened (decorrelated and normalized) using the data covariance matrix |
| Jaccard similarity | "Set overlap" | Size of intersection divided by size of union. For sets, not vectors |
| Edit distance | "Levenshtein distance" | Minimum insertions, deletions, and substitutions to transform one string into another |
| KL divergence | "Distance between distributions" | Not a true distance (not symmetric). Measures extra bits from using $Q$ to encode $P$ |
| Wasserstein distance | "Earth mover's distance" | Minimum work to transport mass from one distribution to another. A true metric |
| Approximate nearest neighbor | "ANN search" | Algorithms (HNSW, LSH, IVF) that find approximately closest points much faster than exact search |
| HNSW | "The vector DB algorithm" | Hierarchical Navigable Small World graph. Multi-layer graph for fast approximate nearest neighbor search |
| L1 regularization | "Lasso" | Adding the L1 norm of weights to the loss. Drives weights to zero (sparsity) |
| L2 regularization | "Ridge" or "weight decay" | Adding the squared L2 norm of weights to the loss. Shrinks weights toward zero without sparsity |
| Elastic Net | "L1 + L2" | Combines L1 and L2 regularization. Handles correlated feature groups better than either alone |

## Đọc thêm

- [FAISS: A Library for Efficient Similarity Search](https://github.com/facebookresearch/faiss)- Thư viện Meta cho tìm kiếm ANN tỷ tỷ
- [Wasserstein GAN (Arjovsky et al., 2017)](https://arxiv.org/abs/1701.07875)- tờ báo giới thiệu khoảng cách của Earth Mover với GAN
- [Locality-Sensitive Hashing (Indyk & Motwani, 1998)](https://dl.acm.org/doi/10.1145/276698.276876)- thuật toán ANN cơ bản
- [Efficient Estimation of Word Representations (Mikolov et al., 2013)](https://arxiv.org/abs/1301.3781)- Word2Vec, nơi sự tương đồng cosine trở thành mặc định cho các nhúng
- [sklearn.neighbors documentation](https://scikit-learn.org/stable/modules/neighbors.html)- hướng dẫn thực tế về métrics khoảng cách và thuật toán hàng xóm trong scikit-learn
