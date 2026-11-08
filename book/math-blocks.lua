function CodeBlock(block)
  if block.classes[1] == "math" then
    return pandoc.Para({ pandoc.Math("DisplayMath", block.text) })
  end
end
